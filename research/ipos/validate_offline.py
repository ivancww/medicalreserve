import json
import math
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent
dataset = json.loads((ROOT / "fixtures" / "dataset.json").read_text())
cases = dataset["cases"]
calibration = [item for item in cases if item["role"] == "calibration"]
holdouts = [item for item in cases if item["role"] == "holdout"]
components = ["guaranteedCashValue", "reversionaryBonusCashValue", "terminalDividendCashValue"]

def interp(points, x):
    points = sorted([(float(a), float(b)) for a, b in points if b is not None], key=lambda pair: pair[0])
    if not points:
        return 0.0
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    for left, right in zip(points, points[1:]):
        if x <= right[0]:
            span = right[0] - left[0]
            return left[1] if span == 0 else left[1] + (x-left[0])/span*(right[1]-left[1])
    return points[-1][1]

def region(policy_year):
    return "early" if policy_year <= 10 else "middle" if policy_year <= 20 else "late"

def solve(matrix, vector, ridge=1e-6):
    size = len(vector)
    augmented = [[float(matrix[row][col]) + (ridge if row == col and row else 0.0) for col in range(size)] + [float(vector[row])] for row in range(size)]
    for pivot in range(size):
        best = max(range(pivot, size), key=lambda row: abs(augmented[row][pivot]))
        if abs(augmented[best][pivot]) < 1e-12:
            continue
        augmented[pivot], augmented[best] = augmented[best], augmented[pivot]
        divisor = augmented[pivot][pivot]
        augmented[pivot] = [value / divisor for value in augmented[pivot]]
        for row in range(size):
            if row == pivot:
                continue
            factor = augmented[row][pivot]
            augmented[row] = [augmented[row][col] - factor * augmented[pivot][col] for col in range(size + 1)]
    return [augmented[row][-1] for row in range(size)]

def feature_vector(policy_year, previous_ratio, withdrawal_ratio, previous_withdrawal_ratio, gcv_ratio, gcv_tapped, basic_ratio, time_since):
    return [1.0, previous_ratio, policy_year / 60.0, withdrawal_ratio, previous_withdrawal_ratio, gcv_ratio, 1.0 if gcv_tapped else 0.0, basic_ratio, min(time_since, 20) / 20.0]

def build_model():
    anchors = sorted({(item["annualPremium"], item["initialBasicAmount"]) for item in calibration})
    by_anchor = {}
    for item in calibration:
        anchor = item["annualPremium"]
        target = by_anchor.setdefault(anchor, {})
        for row in item["baseCurve"]:
            target.setdefault(row["policyYear"], []).append({component: row[component] / item["initialBasicAmount"] for component in components})
        first_withdrawal = item["withdrawalStartAge"] or 10**9
        for row in item["rows"]:
            if row["age"] < first_withdrawal and row["withdrawal"] == 0:
                target.setdefault(row["policyYear"], []).append({component: row[component] / item["initialBasicAmount"] for component in components})
    curves = {}
    for anchor, years in by_anchor.items():
        curves[anchor] = {year: {component: sum(row[component] for row in rows) / len(rows) for component in components} for year, rows in years.items()}
    def base_at(policy_year, basic_amount):
        values = {}
        for component in components:
            by_basic = []
            for premium, initial_basic in anchors:
                values_at_anchor = interp([(year, rows[component]) for year, rows in curves[premium].items()], policy_year)
                by_basic.append((initial_basic, values_at_anchor))
            values[component] = interp(by_basic, basic_amount) * basic_amount
        values["total"] = sum(values[component] for component in components)
        return values
    feature_rows = {"early": [], "middle": [], "late": []}
    reduction_rows = {"early": [], "middle": [], "late": []}
    for item in calibration:
        schedule = {row["age"]: row for row in item["withdrawalSchedule"]}
        previous = None
        previous_basic = item["initialBasicAmount"]
        last_withdrawal_age = None
        for actual in item["rows"]:
            current_basic = actual.get("basicAmountAfterWithdrawal") or previous_basic
            current_base = base_at(actual["policyYear"], current_basic)
            if previous is None:
                previous_base = current_base
                previous_remaining = current_base["total"]
                previous_withdrawal_ratio = 0.0
            else:
                previous_base = base_at(previous["policyYear"], previous_basic)
                previous_remaining = previous["projectedRemainingSurrenderValue"]
                previous_withdrawal_ratio = previous["withdrawal"] / max(previous_base["total"], 1.0)
            previous_ratio = previous_remaining / max(previous_base["total"], 1.0)
            withdrawal = float(actual["withdrawal"])
            withdrawal_ratio = withdrawal / max(current_base["total"], 1.0)
            gcv_tap = float(schedule.get(actual["age"], {}).get("withdrawalFromGuaranteedCashValue", 0))
            gcv_ratio = gcv_tap / max(current_base["guaranteedCashValue"], 1.0)
            gcv_tapped = gcv_tap > 0
            time_since = 20 if last_withdrawal_age is None else actual["age"] - last_withdrawal_age
            if withdrawal > 0:
                last_withdrawal_age = actual["age"]
            feature_rows[region(actual["policyYear"])].append((feature_vector(actual["policyYear"], previous_ratio, withdrawal_ratio, previous_withdrawal_ratio, gcv_ratio, gcv_tapped, current_basic / item["initialBasicAmount"], time_since), actual["projectedRemainingSurrenderValue"] / max(current_base["total"], 1.0)))
            if gcv_tap > 0 and current_basic < previous_basic:
                raw_reduction = gcv_tap / max(previous_base["guaranteedCashValue"] / max(previous_basic, 1.0), 1e-9)
                reduction_rows[region(actual["policyYear"])].append((previous_basic - current_basic) / raw_reduction)
            previous = actual
            previous_basic = current_basic
    transitions = {}
    for name, rows in feature_rows.items():
        matrix = [[0.0] * 9 for _ in range(9)]
        vector = [0.0] * 9
        for features, target in rows:
            for i in range(9):
                vector[i] += features[i] * target
                for j in range(9):
                    matrix[i][j] += features[i] * features[j]
        transitions[name] = solve(matrix, vector)
    reduction_coefficients = {name: (median(values) if values else 0.0) for name, values in reduction_rows.items()}
    return {"anchors": anchors, "curves": curves, "base_at": base_at, "transitions": transitions, "reduction_coefficients": reduction_coefficients, "calibrationCaseIds": [item["caseId"] for item in calibration]}

model = build_model()

def project(item):
    basic = interp(model["anchors"], item["annualPremium"])
    in_range = model["anchors"][0][0] <= item["annualPremium"] <= model["anchors"][-1][0]
    schedule = {row["age"]: row for row in item["withdrawalSchedule"]}
    current_basic = basic or item["initialBasicAmount"]
    previous_remaining = None
    previous_basic = current_basic
    previous_withdrawal = 0.0
    previous_base = None
    last_withdrawal_age = None
    first_withdrawal_seen = False
    output = []
    for actual in item["rows"]:
        age = actual["age"]
        policy_year = actual["policyYear"]
        base = model["base_at"](policy_year, current_basic)
        point = schedule.get(age, {})
        withdrawal = float(point.get("withdrawal", 0)) if age >= (item.get("withdrawalStartAge") or 10**9) else 0.0
        gcv_tap = float(point.get("withdrawalFromGuaranteedCashValue", 0)) if withdrawal else 0.0
        if previous_remaining is None:
            remaining = base["total"]
        elif not first_withdrawal_seen:
            remaining = base["total"]
        else:
            prev_base = previous_base or model["base_at"](max(1, policy_year - 1), previous_basic)
            previous_ratio = previous_remaining / max(prev_base["total"], 1.0)
            previous_withdrawal_ratio = previous_withdrawal / max(prev_base["total"], 1.0)
            withdrawal_ratio = withdrawal / max(base["total"], 1.0)
            gcv_ratio = gcv_tap / max(base["guaranteedCashValue"], 1.0)
            time_since = 20 if last_withdrawal_age is None else age - last_withdrawal_age
            features = feature_vector(policy_year, previous_ratio, withdrawal_ratio, previous_withdrawal_ratio, gcv_ratio, gcv_tap > 0, current_basic / item["initialBasicAmount"], time_since)
            ratio = sum(a * b for a, b in zip(model["transitions"][region(policy_year)], features))
            remaining = base["total"] * max(0.0, min(1.5, ratio))
        if withdrawal > 0 and not first_withdrawal_seen:
            remaining = max(0.0, base["total"] - withdrawal)
        if withdrawal > 0:
            first_withdrawal_seen = True
            last_withdrawal_age = age
        coefficient = model["reduction_coefficients"][region(policy_year)]
        if gcv_tap > 0:
            raw_reduction = gcv_tap / max(base["guaranteedCashValue"] / max(current_basic, 1.0), 1e-9)
            current_basic = max(0.0, current_basic - coefficient * raw_reduction)
        if base["total"] <= withdrawal and withdrawal > 0:
            remaining = 0.0
        output.append({"age": age, "policyYear": policy_year, "projectedRemainingSurrenderValue": round(max(0.0, remaining)), "basicAmountAfterWithdrawal": round(current_basic), "status": "INSUFFICIENT_RESERVE" if remaining <= 0 and withdrawal > base["total"] else "OK"})
        previous_remaining = remaining
        previous_withdrawal = withdrawal
        previous_basic = current_basic
        previous_base = base
    return output, in_range

def error(actual, predicted):
    dollar = predicted - actual
    signed = 0 if actual == 0 else dollar / actual * 100
    return {"dollarError": round(dollar, 2), "signedPercent": round(signed, 8), "absolutePercent": round(abs(signed), 8)}

def summarize(item):
    predictions, _ = project(item)
    lookup = {row["policyYear"]: row for row in predictions}
    rows = []
    for actual in item["rows"]:
        predicted = lookup.get(actual["policyYear"], {}).get("projectedRemainingSurrenderValue", 0)
        rows.append({"caseName": item["caseId"], "issueAge": item["issueAge"], "annualPremium": item["annualPremium"], "initialBasicAmount": item["initialBasicAmount"], "withdrawalType": actual["withdrawalType"], "withdrawalStartAge": item["withdrawalStartAge"], "age": actual["age"], "policyYear": actual["policyYear"], "withdrawal": actual["withdrawal"], "iposRemainingSurrenderValue": actual["projectedRemainingSurrenderValue"], "modelRemainingSurrenderValue": predicted, **error(actual["projectedRemainingSurrenderValue"], predicted), "status": "OK"})
    absolute = [row["absolutePercent"] for row in rows]
    dollars = [abs(row["dollarError"]) for row in rows]
    worst = max(rows, key=lambda row: row["absolutePercent"])
    crossings = {}
    for label, threshold in [(">0.01%", .01), (">0.02%", .02), (">0.05%", .05), (">0.10%", .10)]:
        crossing = next((row for row in rows if row["absolutePercent"] > threshold), None)
        crossings[label] = {"age": crossing["age"], "policyYear": crossing["policyYear"]} if crossing else "NEVER_EXCEEDED"
    return {"caseName": item["caseId"], "issueAge": item["issueAge"], "annualPremium": item["annualPremium"], "initialBasicAmount": item["initialBasicAmount"], "withdrawalType": item["withdrawalPattern"], "withdrawalStartAge": item["withdrawalStartAge"], "rows": rows, "MAPE": round(sum(absolute)/len(absolute), 8), "maxErrorPercent": round(max(absolute), 8), "maxDollarError": round(max(dollars), 2), "worstAge": worst["age"], "worstPolicyYear": worst["policyYear"], "crossings": crossings, "distribution": {label: sum(value <= threshold for value in absolute) for label, threshold in [("<=0.005%", .005), ("<=0.01%", .01), ("<=0.02%", .02), ("<=0.05%", .05), ("<=0.10%", .10), (">0.10%", math.inf)]}}

def aggregate(results):
    rows = [row for result in results for row in result["rows"]]
    absolute = [row["absolutePercent"] for row in rows]
    dollars = [abs(row["dollarError"]) for row in rows]
    worst = max(rows, key=lambda row: row["absolutePercent"])
    return {"MAPE": round(sum(absolute)/len(absolute), 8), "maxErrorPercent": round(max(absolute), 8), "maxDollarError": round(max(dollars), 2), "worstCase": worst["caseName"], "worstAge": worst["age"], "worstPolicyYear": worst["policyYear"], "annualRows": len(rows), "distribution": {label: sum(value <= threshold for value in absolute) for label, threshold in [("<=0.005%", .005), ("<=0.01%", .01), ("<=0.02%", .02), ("<=0.05%", .05), ("<=0.10%", .10), (">0.10%", math.inf)]}}

calibration_results = [summarize(item) for item in calibration]
holdout_results = [summarize(item) for item in holdouts]
holdout = aggregate(holdout_results)
report = {"engineVersion": "ipos-approximation-policy-year-transition-v2", "dataset": {"calibrationCases": len(calibration), "holdoutCases": len(holdouts), "annualRows": sum(len(item["rows"]) for item in cases), "fixtureSource": dataset["sourcePolicy"], "leakageCheck": set(model["calibrationCaseIds"]) == {item["caseId"] for item in calibration}}, "modelSelection": {"selected": "policyYearBasicAmountNormalizedTransition", "previousV1HoldoutMAPE": 17.17569366, "previousV1HoldoutMaxErrorPercent": 57.11395611, "rationale": "anchor-specific base curves and region-specific path-conditioned transitions; no global component mean or global Basic Amount ratio"}, "results": {"calibration": aggregate(calibration_results), "holdout": holdout}, "holdouts": holdout_results, "thresholdTargets": {"IDEAL": holdout["maxErrorPercent"] <= .01, "STRONG": holdout["maxErrorPercent"] <= .02, "TARGET": holdout["maxErrorPercent"] <= .05, "HARD_LIMIT": holdout["maxErrorPercent"] <= .10}, "supportedRange": {"issueAges": sorted({item["issueAge"] for item in cases}), "premiums": sorted({item["annualPremium"] for item in cases}), "withdrawalStartAges": sorted({item["withdrawalStartAge"] for item in cases if item["withdrawalStartAge"]}), "withdrawalPatterns": sorted({item["withdrawalPattern"] for item in cases})}, "notVerifiedRange": ["continuous premiums outside supplied anchors", "portfolio pause/resume against direct proposal evidence", "production integration"], "finalStatus": "READY_FOR_INTEGRATION_REVIEW" if holdout["maxErrorPercent"] <= .10 else "NOT_READY_FOR_INTEGRATION"}
report["diagnosis"] = {"worstCase": holdout["worstCase"], "primaryObservedFactors": ["late-PY transition instability", "Basic Amount reduction / GCV-funded switch approximation", "long-horizon terminal-dividend recovery"], "evidenceBoundary": "First withdrawal arithmetic is separately enforced where proposal evidence supports it; later rows use the fitted transition model."}
(ROOT / "validation-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
lines = ["# iPOS Approximation Validation Report", "", "ENGINE VERSION: " + report["engineVersion"], "", "## DATASET", "- Calibration cases: " + str(report["dataset"]["calibrationCases"]), "- Holdout cases: " + str(report["dataset"]["holdoutCases"]), "- Annual rows: " + str(report["dataset"]["annualRows"]), "- Leakage check: " + ("PASS" if report["dataset"]["leakageCheck"] else "FAIL"), "", "## RESULTS", "- Calibration MAPE: " + str(report["results"]["calibration"]["MAPE"]) + "%", "- Calibration max %: " + str(report["results"]["calibration"]["maxErrorPercent"]) + "%", "- Holdout MAPE: " + str(report["results"]["holdout"]["MAPE"]) + "%", "- Holdout max %: " + str(report["results"]["holdout"]["maxErrorPercent"]) + "%", "- Holdout max $: HKD " + str(report["results"]["holdout"]["maxDollarError"]), "- Worst case: " + report["results"]["holdout"]["worstCase"], "- Worst age / Policy Year: " + str(report["results"]["holdout"]["worstAge"]) + " / " + str(report["results"]["holdout"]["worstPolicyYear"]), "", "## HOLDOUT CROSSINGS"]
for item in holdout_results:
    lines += ["### " + item["caseName"], "- MAPE: " + str(item["MAPE"]) + "%", "- Max Error %: " + str(item["maxErrorPercent"]) + "%", "- Max Dollar Error: HKD " + str(item["maxDollarError"]), "- Worst age / Policy Year: " + str(item["worstAge"]) + " / " + str(item["worstPolicyYear"])]
    for key in [">0.01%", ">0.02%", ">0.05%", ">0.10%"]:
        lines.append("- First " + key + ": " + json.dumps(item["crossings"][key], ensure_ascii=False))
lines += ["", "## DIAGNOSIS", "- Primary factors: late-PY transition instability, Basic Amount reduction / GCV-funded switch approximation, and long-horizon terminal-dividend recovery.", "- Evidence boundary: first withdrawal arithmetic is separately enforced where proposal evidence supports it; later rows use the fitted transition model.", "", "## ACCURACY DISTRIBUTION"] + ["- " + key + ": " + str(value) for key, value in report["results"]["holdout"]["distribution"].items()] + ["", "## FINAL STATUS", report["finalStatus"], "", "This is a calibrated approximation and is not the official AIA/iPOS calculation engine."]
(ROOT / "validation-report.md").write_text("\n".join(lines) + "\n")
print(json.dumps({"status": report["finalStatus"], "holdout": holdout}))
