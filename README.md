# WeLearn Course Catalog

Public, interactive catalog for published WeLearn lessons, available translations and country assignments.

## Data source

The site reads three tabs from the professional Google Sheet during its GitHub Actions build:

- `Courses catalog`
- `WeLearn Updates`
- `Translation Log`

Only the fields used by the public catalog are included in the generated site. The Google Sheet itself remains private.

## One-time GitHub setup

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions**.
4. Create a repository secret named `GOOGLE_SERVICE_ACCOUNT_JSON` containing the complete JSON credential of a read-only Google service account.
5. Share the source Google Sheet with that service account email as **Viewer**.
6. Open **Actions → Deploy WeLearn Catalog → Run workflow**.

No Google Sheet data is stored in the public repository history. The secret must be configured before the first successful deployment. The workflow refreshes the catalog every six hours and whenever it is run manually.

## Local development

```bash
npm install
npm run dev
```
