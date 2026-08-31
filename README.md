# WeLearn Course Catalog

Public, interactive catalog for published WeLearn lessons, available translations and country assignments.

## Data source

The site reads three tabs from the professional Google Sheet during its GitHub Actions build:

- `Courses catalog`
- `WeLearn Updates`
- `Translation Log`

Only the fields used by the public catalog are included. The dedicated public description in column BB is used instead of the internal description; course objectives are indexed for search but are not displayed in lesson details. The Google Sheet itself remains private.

The build publishes the resulting data in two complementary formats:

`https://allison-thierry.github.io/we-learn-catalog/catalog.json`

`https://allison-thierry.github.io/we-learn-catalog/knowledge/catalog.html`

The interactive catalog reads the JSON file. The static HTML page contains the same useful public course information directly in the document, without React or JavaScript rendering, for AI and Knowledge ingestion. Both files are generated automatically from the same dataset.

## One-time GitHub setup

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions**.
4. Create a repository secret named `GOOGLE_SERVICE_ACCOUNT_JSON` containing the complete JSON credential of a read-only Google service account.
5. Share the source Google Sheet with that service account email as **Viewer**.
6. Open **Actions → Deploy WeLearn Catalog → Run workflow**.

No real Google Sheet data is stored in the public repository history: the committed `public/catalog.json` is an empty schema placeholder, and the Knowledge HTML page is created only during deployment. The secret must be configured before the first successful deployment. The workflow refreshes both public data formats every six hours and whenever it is run manually.

## Local development

```bash
npm install
npm run dev
```
