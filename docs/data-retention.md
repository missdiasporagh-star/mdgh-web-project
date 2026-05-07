# Data Retention & Cleanup

## Policy

Per `src/data/privacy.md`, applicant data is retained for **3 years after the close of the cycle** for which they applied, then permanently deleted.

## How cleanup runs

V1 uses a manual one-shot cleanup script: `scripts/data-retention-cleanup.ts`. Run it after a cycle's 3-year retention window has elapsed.

## What the cleanup does

For each application in cycles closed >= 3 years ago:
1. Lists the R2 keys (`headshot_r2_key`, `video_r2_key`)
2. Deletes the R2 objects
3. Deletes the `applications` row
4. Deletes the corresponding `cycles` row if no applications remain

`cycle_notifications` is not affected by this script (those are subscription records, not applications). Subscribers can be removed individually on unsubscribe (future feature).

## Safety

- The script does a **dry run by default** — pass `--apply` to actually delete.
- It logs every deleted key + row to stdout for audit.
- Run it from a local machine with the production R2 credentials, never as part of CI.
