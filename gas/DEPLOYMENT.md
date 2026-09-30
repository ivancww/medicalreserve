# Medical Reserve GAS deployment

GAS DEPLOYMENT REQUIRED

`gas/Code.gs` is the source for the existing Medical Reserve Web App deployment. It is not deployed by this repository change.

1. Open the existing Apps Script project behind the Medical Reserve endpoint.
2. Replace the deployment source with `gas/Code.gs`; preserve the existing spreadsheet binding and deployment URL.
3. Configure Script Properties:
   - `AVA_PLATFORM_ADMIN_AUTH_URL` = the deployed AVA Platform Admin GAS Web App URL.
   - The source uses the fixed App ID `medicalreserve`.
4. In the AVA Platform GAS deployment, add `medicalreserve` to the reviewed `AVA_ADMIN_APP_IDS` list.
5. Deploy a new version of the same Web App deployment.
6. Obtain a fresh Platform Admin launch ticket and verify exchange, invalid/expired grant rejection, one write per allowlisted resource, read-back, and version increment against the deployed endpoint.

The live endpoint must not be described as write-enabled until those steps and read-back verification succeed.
