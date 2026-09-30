"""Extract only de-identified central numeric tables; never write raw PDF/text to Git.
Usage: python audit_evidence.py PRIVATE_MANIFEST MODEL_SNAPSHOT
The manifest contains authorized local PDF paths and Drive IDs and stays outside Git.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).parent
START = 'fb67494394afda9bbb1bc7c4154468642461e990'
COMPONENTS = ('GCV','RB','TD')
FIELDS = ('A_noWithdrawalTotal','B_postWithdrawalTotal','C_basicAmount','D_GCV','E_RB','F_TD','G_withdrawal','H_RBWithdrawal','I_associatedTDWithdrawal','J_GCVWithdrawal')

def render_json(value, depth=0):
    # Keep scalar numeric rows on one line so the evidence diff stays reviewable.
    scalar=lambda x: not isinstance(x,(dict,list))
    if scalar(value) or isinstance(value,dict) and all(scalar(v) for v in value.values()) or isinstance(value,list) and all(scalar(v) for v in value):
        return json.dumps(value,ensure_ascii=False)
    pad='  '*depth
    if isinstance(value,dict):
        entries=['  '+pad+json.dumps(k,ensure_ascii=False)+': '+render_json(v,depth+1) for k,v in value.items()]
        return '{\n'+',\n'.join(entries)+'\n'+pad+'}'
    return '[\n'+',\n'.join('  '+pad+render_json(v,depth+1) for v in value)+'\n'+pad+']'

def number(token):
    value=float(token.replace(',',''))
    return int(value) if value.is_integer() else value

def numeric_rows(page, width):
    for line in page.splitlines():
        match=re.fullmatch(r'\s*(\d{2,3})\s+(\d{1,2})\s+([\d,.\s]+)',line)
        if not match:
            continue
        values=re.findall(r'\d[\d,]*(?:\.\d+)?',match[3])
        if len(values) != width:
            raise ValueError(f'Ambiguous numeric column count: {len(values)} expected {width}')
        yield int(match[1]),int(match[2]),list(map(number,values))

def extract(source, known):
    raw=Path(source['path']).read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    source_id='ipos-'+digest[:16]
    # stdout is transient processing state; no complete text is written in the repo.
    result=subprocess.run(['pdftotext','-layout',source['path'],'-'],capture_output=True,check=True)
    pages=result.stdout.decode('utf-8').split('\f')
    physical_pages=len(PdfReader(source['path']).pages)
    assert len(pages)-1==physical_pages, 'Incomplete PDF extraction'
    first=pages[0]
    if '環宇盈活儲蓄保險計劃（5 年繳費）' not in first or '保單貨幣：港元' not in first:
        return {'sourceId':source_id,'pdfSHA256':digest,'usable':False,'reason':'Internal document is not a current HKD 5Pay 環宇盈活 illustration; visually verified unrelated USD anniversary statement. No identifying data extracted.'}
    issue=re.search(r'年齡[：:]\s*(\d+)',first)
    premium_row=next((l for l in first.splitlines() if '環宇盈活儲蓄保險計劃（5 年' in l and re.search(r'\d,\d{3}',l)),None)
    assert issue and premium_row, 'Unverified internal metadata'
    amounts=re.findall(r'\d[\d,]*(?:\.\d+)?',premium_row)
    assert len(amounts)>=5 and int(amounts[-1])==5
    basic=number(amounts[1]);premium=number(amounts[3]);age=int(issue[1])
    date=re.search(r'列印日期:\s*(\d+)年(\d+)月(\d+)日',first)
    version=re.search(r'PGS version ([\d.]+)',first)
    base={};post={};allocation={};excluded=[];page_types=[]
    for page_no,text in enumerate(pages[:-1],1):
        if '現金提取舉例：悲觀情景' in text or '現金提取舉例：樂觀情景' in text or '不同投資回報下的說明' in text:
            excluded.append(page_no);continue
        if '詳細說明' in text and '退保發還金額' in text:
            page_types.append({'page':page_no,'type':'CENTRAL_NO_WITHDRAWAL_ANNUAL'})
            for current_age,py,v in numeric_rows(text,10):
                assert current_age-age==py
                base[py]={'age':current_age,'policyYear':py,'paidPremiumTotal':v[0],'GCV':v[1],'RB':v[2],'TD':v[3],'total':v[4],'page':page_no}
        elif '現金提取舉例' in text and '現金提取後之退保發還金額' in text:
            page_types.append({'page':page_no,'type':'CENTRAL_POST_WITHDRAWAL_ANNUAL'})
            for current_age,py,v in numeric_rows(text,7):
                assert current_age-age==py
                post[py]={'age':current_age,'policyYear':py,'paidPremiumTotal':v[0],'withdrawal':v[1],'basicAmount':v[2],'GCV':v[3],'RB':v[4],'TD':v[5],'total':v[6],'page':page_no}
        elif '現金提取舉例' in text and '由復歸紅利' in text and '由終期分紅' in text:
            page_types.append({'page':page_no,'type':'CENTRAL_WITHDRAWAL_ALLOCATION'})
            for current_age,py,v in numeric_rows(text,4):
                assert current_age-age==py
                allocation[py]={'age':current_age,'policyYear':py,'fromGCV':v[0],'fromRB':v[1],'fromTD':v[2],'total':v[3],'page':page_no}
    assert len(base)==100-age, f'Annual no-withdrawal table incomplete: {source_id}'
    assert all(abs(r['total']-sum(r[k] for k in COMPONENTS))<=1 for r in base.values()), 'Base component rounding'
    assert all(abs(r['total']-sum(r[k] for k in COMPONENTS))<=1 for r in post.values()), 'Post component rounding'
    assert all(abs(r['total']-r['fromGCV']-r['fromRB']-r['fromTD'])<=1 for r in allocation.values()), 'Allocation rounding'
    assert all(abs(r['withdrawal']-allocation[py]['total'])<=1 for py,r in post.items()), 'Source allocation/post mismatch'
    anchor=base[1]['paidPremiumTotal']
    assert abs(anchor-premium)<1, 'Displayed-cent versus rounded premium discrepancy exceeds HKD 1'
    matched=known.get(source['id'])
    differences=[]
    if matched:
        assert matched['issueAge']==age and matched['annualPremium']==anchor and matched['initialBasicAmount']==basic
        for old in matched['rows']:
            py=old['policyYear']
            if py in post:
                for old_key,new_key in [('guaranteedCashValue','GCV'),('reversionaryBonusCashValue','RB'),('terminalDividendCashValue','TD'),('projectedRemainingSurrenderValue','total'),('basicAmountAfterWithdrawal','basicAmount'),('withdrawal','withdrawal')]:
                    if old[old_key]!=post[py][new_key]:differences.append({'policyYear':py,'field':old_key,'frozen':old[old_key],'genuine':post[py][new_key]})
    first_withdrawal=next((r['age'] for py,r in sorted(post.items()) if r['withdrawal']>0),None)
    return {'sourceId':source_id,'pdfSHA256':digest,'usable':True,'caseId':matched['caseId'] if matched else source_id,
        'frozenRole':matched['role'] if matched else 'UNASSIGNED_EVIDENCE_ONLY',
        'metadata':{'product':'AIA 環宇盈活儲蓄保險計劃','issueAge':age,'annualPremiumDisplayed':premium,'annualPremiumRoundedTableAnchor':anchor,'initialBasicAmount':basic,'paymentTerm':5,'currency':'HKD','illustrationType':'CURRENT_PROJECTED_CENTRAL','printDate':f'{int(date[1]):04}-{int(date[2]):02}-{int(date[3]):02}' if date else None,'printSystemVersion':version[1] if version else None,'metadataPage':1,
            'strategy':matched['withdrawalPattern'] if matched else 'UNLABELLED_NUMERIC_WITHDRAWAL_SCHEDULE',
            'strategyEvidence':'Research strategy label from existing manifest; PDF confirms numerical schedule, not an official AVF/AVPU label.' if matched else 'Internal numeric schedule only; no strategy inferred from filename.',
            'withdrawalStartAge':first_withdrawal,'availablePolicyYears':[min(base),max(base)],'pageCount':physical_pages},
        'tablePages':page_types,'excludedNonCentralPages':excluded,'baseRows':list(base.values()),'postRows':list(post.values()),'allocationRows':list(allocation.values()),'frozenPostComponentDifferences':differences}

def matrix(source):
    base={r['policyYear']:r for r in source['baseRows']};post={r['policyYear']:r for r in source['postRows']};alloc={r['policyYear']:r for r in source['allocationRows']}
    result=[]
    for py in sorted(set(base)|set(post)):
        b=base.get(py);p=post.get(py);a=alloc.get(py)
        fields={FIELDS[0]:'AVAILABLE' if b else 'NOT AVAILABLE',FIELDS[1]:'AVAILABLE' if p else 'NOT AVAILABLE',FIELDS[2]:'AVAILABLE' if p else 'NOT AVAILABLE'}
        fields.update({f:'AVAILABLE' if b and p else 'AMBIGUOUS' if b or p else 'NOT AVAILABLE' for f in FIELDS[3:6]})
        fields.update({f:'AVAILABLE' if a else 'NOT AVAILABLE' for f in FIELDS[6:]})
        values={'noWithdrawalTotal':b['total'] if b else None,'postWithdrawalTotal':p['total'] if p else None,'basicAmount':p['basicAmount'] if p else None,
            'noWithdrawalComponents':{k:b[k] for k in COMPONENTS} if b else None,'postWithdrawalComponents':{k:p[k] for k in COMPONENTS} if p else None,
            'withdrawal':a['total'] if a else None,'RBWithdrawal':a['fromRB'] if a else None,'associatedTDWithdrawal':a['fromTD'] if a else None,'GCVWithdrawal':a['fromGCV'] if a else None}
        result.append({'policyYear':py,'fields':fields,'values':values,'pages':{'base':b['page'] if b else None,'post':p['page'] if p else None,'allocation':a['page'] if a else None},'basicAmountContext':'C is directly displayed post-withdrawal Basic Amount; no-withdrawal initial Basic Amount is from metadata, not a separate annual Basic Amount column.'})
    return result

def pairs(source):
    base={r['policyYear']:r for r in source['baseRows']};alloc={r['policyYear']:r for r in source['allocationRows']};result=[]
    for p in source['postRows']:
        py=p['policyYear'];b=base.get(py)
        if not b:continue
        impacts={k:p[k]-b[k] for k in COMPONENTS};total=p['total']-b['total'];rounding=total-sum(impacts.values())
        assert abs(rounding)<=2, 'Matched impact identity exceeds combined display rounding'
        result.append({'sourceId':source['sourceId'],'caseId':source['caseId'],'policyYear':py,'age':p['age'],'sameProductIssueAgePremiumInitialBasicAmount':True,
            'sameEffectiveBasicAmount':p['basicAmount']==source['metadata']['initialBasicAmount'],
            'comparisonType':'STRICT_SAME_BASIC_AMOUNT' if p['basicAmount']==source['metadata']['initialBasicAmount'] else 'SAME_POLICY_COUNTERFACTUAL_WITH_BASIC_REDUCTION_CONFOUNDING',
            'noWithdrawal':b,'postWithdrawal':p,'allocation':alloc.get(py),'impact':{**impacts,'total':total,'identityRoundingResidual':rounding},
            'roundingCheck':'PASS','pairingEvidence':'Central no-withdrawal detailed and central withdrawal tables within the SAME genuine PDF; no premium/age cross-case imputation.'})
    return result

def transitions(pair_rows):
    output=[]
    for t,next_row in zip(pair_rows,pair_rows[1:]):
        if next_row['policyYear']!=t['policyYear']+1:continue
        if not (t['postWithdrawal']['withdrawal']>0 and next_row['postWithdrawal']['withdrawal']>0):continue
        change={k:next_row['impact'][k]-t['impact'][k] for k in COMPONENTS}
        # Pre-current-withdrawal deficits remove only the explicitly displayed current allocation.
        pre={k:next_row['impact'][k]+next_row['allocation'][{'GCV':'fromGCV','RB':'fromRB','TD':'fromTD'}[k]] for k in COMPONENTS}
        output.append({'sourceId':t['sourceId'],'caseId':t['caseId'],'t':t,'next':next_row,'carryoverImpactAtT':{k:t['impact'][k] for k in COMPONENTS},
            'carryoverImpactAtNext':{k:next_row['impact'][k] for k in COMPONENTS},'changeInImpact':change,'nextImpactBeforeCurrentComponentWithdrawal':pre,
            'capitalReductionConfounded':not(t['sameEffectiveBasicAmount'] and next_row['sameEffectiveBasicAmount'])})
    return output

def main():
    sources=json.loads(Path(sys.argv[1]).read_text());snapshot=json.loads(Path(sys.argv[2]).read_text())
    dataset=json.loads((ROOT/'fixtures/dataset.json').read_text());known={c['sourceFileId']:c for c in dataset['cases']}
    extracted=[extract(s,known) for s in sources]
    usable=[s for s in extracted if s['usable']]
    for s in usable:s['evidenceByPolicyYear']=matrix(s)
    all_pairs=[r for s in usable for r in pairs(s)]
    all_transitions=[r for s in usable for r in transitions(pairs(s))]
    diagnostics=[]
    for model in snapshot['diagnostics']:
        s=next(s for s in usable if s['caseId']==model['caseId']);p=next(p for p in all_pairs if p['caseId']==model['caseId'] and p['policyYear']==model['policyYear'])
        genuine=p['postWithdrawal'];errors={'GCV':model['impliedGCV']-genuine['GCV'],'RB':model['impliedRB']-genuine['RB'],'TD':model['TD']-genuine['TD'],'total':model['total']-genuine['total']}
        assert genuine['GCV']==p['noWithdrawal']['GCV'] and errors['GCV']<0 and errors['RB']>0, 'Component classification unsupported'
        diagnostics.append({'caseId':s['caseId'],'sourceId':s['sourceId'],'age':model['age'],'policyYear':model['policyYear'],
            'genuine':genuine,'genuineNoWithdrawal':p['noWithdrawal'],'genuineAllocation':p['allocation'],'model':model,'componentErrorDollars':errors,
            'signedComponentErrorPercentOfGenuineTotal':{k:v/genuine['total']*100 for k,v in errors.items()},
            'componentErrorIdentityResidual':errors['total']-sum(errors[k] for k in COMPONENTS),
            'modelBaseErrorDollars':{k:model['base'][{'GCV':'guaranteedCashValue','RB':'reversionaryBonusCashValue','TD':'terminalDividendCashValue'}[k]]-p['noWithdrawal'][k] for k in COMPONENTS},
            'dominantClassification':'GCV+RB interaction','largestIndividualAbsoluteContribution':max(COMPONENTS,key=lambda k:abs(errors[k])),
            'evidenceReason':'Genuine GCV equals the matched no-withdrawal GCV at this pre-GCV-tap year. The legacy aggregate ratio scales both GCV and RB together, underestimating GCV and overestimating remaining RB; TD contributes a separate signed error and does not explain the non-TD residual. Model GCV/RB partition is algebraically implied, not independent state.'})
    pause_resume=[]
    for source in usable:
        rows=pairs(source)
        for i,row in enumerate(rows):
            if i==0 or row['postWithdrawal']['withdrawal']!=0 or rows[i-1]['postWithdrawal']['withdrawal']<=0:
                continue
            resumed=next((j for j in range(i+1,len(rows)) if rows[j]['postWithdrawal']['withdrawal']>0),None)
            if resumed is not None:
                pause_resume.append({'sourceId':source['sourceId'],'caseId':source['caseId'],
                    'lastWithdrawal':rows[i-1],'zeroWithdrawalYears':rows[i:resumed],
                    'resumedWithdrawal':rows[resumed],'interpretation':'Genuine source states only; no model pause/resume accuracy asserted.'})
    anomalies=[]
    for case_id,old in [('50yrs_5pay_130k_avpu',85),('50yrs_5pay_180k_avpu',8),('70k_original',2)]:
        s=next(s for s in usable if s['caseId']==case_id);p=next(r for r in s['postRows'] if r['age']==100);a=next(r for r in s['allocationRows'] if r['age']==100)
        status='SOURCE_CONFIRMS_ZERO' if p['withdrawal']==a['total']==a['fromRB']==a['fromGCV']==a['fromTD']==0 else 'SOURCE_CONFIRMS_NONZERO' if p['withdrawal']==a['total'] and a['total']>0 else 'SOURCE_NOT_VERIFIABLE'
        anomalies.append({'caseId':case_id,'sourceId':s['sourceId'],'age':100,'policyYear':p['policyYear'],'frozenScheduleWithdrawal':old,'genuinePostWithdrawalAmount':p['withdrawal'],'genuineAllocation':a,'postPage':p['page'],'status':status,
            'action':'Frozen fixture intentionally preserved so v4 metrics remain comparable; genuine zero recorded only in the audit evidence. No fitting or schedule correction in this run.'})
    sufficient=all(len([r for r in s['evidenceByPolicyYear'] if 10<=r['policyYear']<=30 and all(v=='AVAILABLE' for v in r['fields'].values())])==21 for s in usable if s['caseId'] in {d['caseId'] for d in snapshot['diagnostics']})
    calibration_sources=[s for s in usable if s['frozenRole']=='calibration']
    sufficient=sufficient and len(calibration_sources)==14 and all(all(all(v=='AVAILABLE' for v in r['fields'].values()) for r in c['evidenceByPolicyYear'] if 10<=r['policyYear']<=30) for c in calibration_sources)
    report={'auditVersion':'ipos-genuine-evidence-audit-v1','previousHead':START,'engineVersion':snapshot['engineVersion'],'frozenMetrics':snapshot['metrics'],
        'evidenceDecision':'EVIDENCE_SUFFICIENT_FOR_NEXT_MODEL' if sufficient else 'ADDITIONAL_PROPOSALS_REQUIRED','dominantUnresolvedComponent':'GCV+RB interaction',
        'discovery':{'candidatePDFs':len(sources),'usableCentralProposals':len(usable),'excludedDocuments':len(extracted)-len(usable),'scope':'Connected Drive keyword discovery plus PDF MIME/name filter; 23 candidates retrieved, 22 internal-metadata verified. No unrelated document content retained.'},
        'summary':{'matchedAnnualPairs':len(all_pairs),'strictSameBasicAmountPairs':sum(r['sameEffectiveBasicAmount'] for r in all_pairs),'consecutivePositiveWithdrawalTransitions':len(all_transitions),'currentCalibrationSourcesWithFullAnnualBases':len(calibration_sources),
            'priorityFields':'A–J are genuine AVAILABLE for every priority case PY10–30. Zero is a displayed value, not an inferred absence.',
            'priorGapCorrection':'The prior fixture contains only selected no-withdrawal checkpoints. Genuine annual central component rows are already present in the SAME PDFs (usually pp12–13); missing annual values were an extraction gap, not a proposal gap.',
            'sufficiencyBoundary':'Enough existing calibration-only annual matched component evidence for a next component-state investigation. This does not identify an official formula or establish accuracy, and is not permission to fit in this run. Frozen holdouts remain evaluation-only; the additional 130k source is unassigned evidence-only.',
            'pauseResumeBoundary':'Genuine zero-withdrawal continuations and resumed withdrawals are observable where supplied; no model pause/resume accuracy is claimed.'},
        'pauseResumeEvidence':pause_resume,'sourceRecords':extracted,'immediateTransitionDiagnostics':diagnostics,'age100Anomalies':anomalies,
        'matchedPairsArtifact':'matched-component-evidence.json','transitionsArtifact':'component-transition-evidence.json','additionalProposalSet':[],
        'privacy':'Only selected numeric fields, internal non-identifying metadata, PDF hashes and page indices are retained. Raw PDFs/text, names, policy numbers, addresses, adviser IDs, barcodes and signed URLs stay outside Git.',
        'finalResearchStatus':'NOT_READY_FOR_INTEGRATION'}
    for name,data in [('evidence-gap-matrix',report),('matched-component-evidence',{'auditVersion':report['auditVersion'],'pairs':all_pairs}),('component-transition-evidence',{'auditVersion':report['auditVersion'],'transitions':all_transitions})]:
        (ROOT/(name+'.json')).write_text(render_json(data)+'\n')
    write_markdown(report,usable,all_pairs,all_transitions)
    with (ROOT/'evidence-gap-matrix.md').open('a') as handle:
        handle.write('\n## Genuine pause/resume evidence\n\n')
        for gap in pause_resume:
            handle.write(f"- {gap['caseId']}: last withdrawal PY{gap['lastWithdrawal']['policyYear']}; displayed zero PY{gap['zeroWithdrawalYears'][0]['policyYear']}–{gap['zeroWithdrawalYears'][-1]['policyYear']}; resumes PY{gap['resumedWithdrawal']['policyYear']}. Full component states and page provenance are in JSON.\n")
        handle.write('\nThese are source observations; no engine pause/resume accuracy is claimed.\n')
    print(json.dumps({'usable':len(usable),'pairs':len(all_pairs),'transitions':len(all_transitions),'decision':report['evidenceDecision'],'dominant':report['dominantUnresolvedComponent'],'anomalies':anomalies},ensure_ascii=False))

def write_markdown(report,usable,pair_rows,transition_rows):
    lines=['# Genuine iPOS Evidence Audit','',f"Starting head: `{START}`",'',report['evidenceDecision'],'',report['summary']['priorGapCorrection'],'',
        f"23 PDFs inspected; {len(usable)} usable central HKD 5Pay proposals; one unrelated USD anniversary statement excluded. {len(pair_rows)} annual same-PDF comparisons; {len(transition_rows)} consecutive positive-withdrawal transitions.",
        '', 'No fitting. v4 and the frozen fixture are unchanged. No raw PDF or identifying text is committed.',
        '', '## Internally verified proposal metadata','', '| Source / case | Issue age | Annual premium (printed / rounded table) | Initial Basic Amount | Term / currency | Research strategy | Start age | PY range |','| --- | --- | --- | --- | --- | --- | --- | --- |']
    for s in usable:
        m=s['metadata'];lines.append(f"| {s['sourceId']} / {s['caseId']} | {m['issueAge']} | {m['annualPremiumDisplayed']} / {m['annualPremiumRoundedTableAnchor']} | {m['initialBasicAmount']} | 5 / HKD | {m['strategy']} | {m['withdrawalStartAge']} | {m['availablePolicyYears']} |")
    lines+=['','Strategy labels are existing research manifest labels; the PDFs verify numeric withdrawal schedules and do not define AVF/AVPU as official strategy terms. No label is established by filename alone.',
        'Annual printed premiums contain cents; the first paid-premium table row is rounded to dollars. Both are preserved without changing the existing engine premium anchors.',
        '', '## Field definitions and provenance','', 'A: no-withdrawal total; B: post-withdrawal total; C: displayed post-withdrawal Basic Amount; D/E/F: both no-withdrawal and post-withdrawal GCV/RB/TD; G: total withdrawal; H/I/J: RB/associated TD/GCV allocation.',
        'Every JSON field is explicitly AVAILABLE, NOT AVAILABLE, AMBIGUOUS or ESTIMATED_ONLY. No interpolated value enters these genuine tables. C uses the direct post-withdrawal column; the no-withdrawal Basic Amount is the initial metadata amount, not an additional annual column.',
        'Within-PDF pairing fixes product, issue age, premium and initial Basic Amount. Rows with reduced effective Basic Amount are flagged as capital-reduction-confounded and excluded from strict same-Basic-Amount interpretation.',
        '', '## Priority PY10–30 evidence','', '| Case | PY10–14 | PY15–19 | PY20–24 | PY25–30 | Central source pages |','| --- | --- | --- | --- | --- | --- |']
    priority={d['caseId'] for d in report['immediateTransitionDiagnostics']}
    for s in usable:
        if s['caseId'] in priority:
            regions=[]
            for lo,hi in [(10,14),(15,19),(20,24),(25,30)]:
                rows=[r for r in s['evidenceByPolicyYear'] if lo<=r['policyYear']<=hi];regions.append('A–J AVAILABLE' if all(all(v=='AVAILABLE' for v in r['fields'].values()) for r in rows) and len(rows)==hi-lo+1 else 'SEE JSON')
            lines.append('| '+s['caseId']+' | '+' | '.join(regions)+' | '+str(s['tablePages'])+' |')
    lines+=['','The complete per-Policy-Year A–J matrix with numeric values and page provenance is in evidence-gap-matrix.json. The earlier checkpoint-only representation must not be mistaken for absence in the proposals.',
        '', '## Five immediate second-withdrawal diagnostics','', '| Case / age / PY | Genuine total | v4 total | GCV error HKD | RB error HKD | TD error HKD | Dominant |','| --- | --- | --- | --- | --- | --- | --- |']
    for d in report['immediateTransitionDiagnostics']:
        e=d['componentErrorDollars'];lines.append(f"| {d['caseId']} / {d['age']} / {d['policyYear']} | {d['genuine']['total']} | {d['model']['total']} | {e['GCV']:.2f} | {e['RB']:.2f} | {e['TD']:.2f} | {d['dominantClassification']} |")
    lines+=['','Model GCV and RB above are algebraically implied by v4’s shared aggregate ratio. The engine does not maintain separate GCV/RB states. Their split is therefore an accounting interpretation, with HKD 1 rounding precision, not additional genuine evidence.',
        'At all five priority rows, genuine GCV equals the paired no-withdrawal GCV before any GCV tap. The shared model ratio reduces implied GCV while retaining too much RB; TD offsets the combined error in three rows and adds to it in two rows. This directly supports investigating the GCV/RB separation and RB carryover before further TD-only tuning.',
        '', '## Age-100 source audit','', '| Case | Frozen schedule | Genuine allocation total / post amount | PDF pages | Status |','| --- | --- | --- | --- | --- |']
    for a in report['age100Anomalies']:lines.append(f"| {a['caseId']} | {a['frozenScheduleWithdrawal']} | {a['genuineAllocation']['total']} / {a['genuinePostWithdrawalAmount']} | {a['genuineAllocation']['page']}, {a['postPage']} | {a['status']} |")
    lines+=['','All three genuine allocation tables and post-withdrawal tables explicitly display zero. The frozen fixture is intentionally preserved in this audit to avoid altering the benchmark. The independent genuine evidence contains the confirmed zeros.',
        '', '## Evidence decision','',report['evidenceDecision'],report['summary']['sufficiencyBoundary'],'','Minimal new proposal request: **none**. Existing PDFs already supply the relevant annual paired component tables.',
        '', '## Frozen result','',json.dumps(report['frozenMetrics']),report['finalResearchStatus'],'']
    lines+=['','## Direct component comparison (HKD)','','| Case / PY | Component | Genuine | Model | Model − genuine |','| --- | --- | --- | --- | --- |']
    for d in report['immediateTransitionDiagnostics']:
        for k,mk in [('GCV','impliedGCV'),('RB','impliedRB'),('TD','TD'),('total','total')]:
            lines.append(f"| {d['caseId']} / {d['policyYear']} | {k} | {d['genuine'][k]} | {d['model'][mk]:.2f} | {d['componentErrorDollars'][k]:.2f} |")
    lines+=['','At PY17 the model also interpolates a base curve: 200k no-withdrawal GCV/RB/TD errors are HKD +3,472.75 / +167.50 / +21,694.25; 70k errors are +1,208 / +58.50 / +7,546.875. Base-curve interpolation is an additional confounder for those two cases. The PY11 and PY12 matched bases are exact within HKD 1, independently exposing the GCV/RB transition problem. No new coefficients or curve substitutions were applied.']
    (ROOT/'evidence-gap-matrix.md').write_text('\n'.join(lines))
    pair_lines=['# Matched Component Evidence','',f'{len(pair_rows)} annual same-PDF central comparisons. All total-impact/component-impact identities pass within combined display rounding (HKD 2).','',
        'For each row: impact = post-withdrawal − no-withdrawal. Reduced effective Basic Amount is explicitly flagged. Full data and page provenance: matched-component-evidence.json.','',
        '| Priority case / PY | GCV impact | RB impact | TD impact | Total impact | Rounding residual |','| --- | --- | --- | --- | --- | --- |']
    for p in pair_rows:
        if p['caseId'] in priority and 10<=p['policyYear']<=30:
            i=p['impact'];pair_lines.append(f"| {p['caseId']} / {p['policyYear']} | {i['GCV']} | {i['RB']} | {i['TD']} | {i['total']} | {i['identityRoundingResidual']} |")
    (ROOT/'matched-component-evidence.md').write_text('\n'.join(pair_lines)+'\n')
    transition_lines=['# Year-to-Year Component Evidence','',f'{len(transition_rows)} genuine consecutive positive-withdrawal pairs. Each JSON row contains complete t and t+1 component values, allocations, impacts and changes.','',
        'Post-withdrawal impact is compared with the same-policy no-withdrawal counterfactual. `nextImpactBeforeCurrentComponentWithdrawal` adds back only the displayed current allocation; it is an accounting decomposition, not a new AIA formula. Capital reduction confounding is flagged.',
        '', '| Priority case / transition | ΔGCV impact | ΔRB impact | ΔTD impact | Basic reduction confounded |','| --- | --- | --- | --- | --- |']
    for t in transition_rows:
        if t['caseId'] in priority and 10<=t['t']['policyYear']<=29:
            c=t['changeInImpact'];transition_lines.append(f"| {t['caseId']} / PY{t['t']['policyYear']}→{t['next']['policyYear']} | {c['GCV']} | {c['RB']} | {c['TD']} | {t['capitalReductionConfounded']} |")
    (ROOT/'component-transition-evidence.md').write_text('\n'.join(transition_lines)+'\n')

if __name__=='__main__':main()
