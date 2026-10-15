# Journal ranking data

SubmitPilot reads journal quartiles (Q1–Q4), SJR, H-index and citations per document from the
SCImago Journal Rank list. SCImago does not allow automated downloads, so the file is added by hand
and is not committed to the repository.

1. Open https://www.scimagojr.com/journalrank.php in a browser.
2. Click **Download data** (top right of the table). This saves a file such as `scimagojr 2025.csv`.
3. Rename it to `scimago.csv` and put it in this `data/` folder.
4. Restart the server. `/api/health` reports `"scimagoLoaded": true` when it is picked up.

Repeat once a year when SCImago publishes new rankings. Without the file, quartiles show as
"Q n/a" and journals cannot be marked as "Not indexed"; the other metrics still work.

SCImago data is © SCImago Lab, based on Scopus data. Credit SCImago when you publish rankings.
