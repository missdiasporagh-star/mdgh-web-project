// Usage: npx tsx scripts/data-retention-cleanup.ts [--apply]
//
// Reads from production D1 + R2 via wrangler bindings.
// Dry-run by default. Pass --apply to actually delete.

import { execSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');

function d1Query<T>(sql: string): T[] {
  const out = execSync(
    `npx wrangler d1 execute mdgh-applications-db --remote --json --command ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function d1Run(sql: string): void {
  if (!APPLY) { console.log(`[dry-run] would run: ${sql}`); return; }
  execSync(
    `npx wrangler d1 execute mdgh-applications-db --remote --command ${JSON.stringify(sql)}`,
    { stdio: 'inherit' }
  );
}

function r2Delete(bucket: string, key: string): void {
  if (!APPLY) { console.log(`[dry-run] would delete r2://${bucket}/${key}`); return; }
  execSync(`npx wrangler r2 object delete ${bucket}/${key}`, { stdio: 'inherit' });
}

const threeYearsAgo = new Date();
threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

const expiredCycles = d1Query<{ id: string; applications_close_at: string }>(
  `SELECT id, applications_close_at FROM cycles WHERE applications_close_at < '${threeYearsAgo.toISOString()}'`
);

console.log(`Found ${expiredCycles.length} cycles past 3-year retention.`);

for (const c of expiredCycles) {
  const apps = d1Query<{ id: string; headshot_r2_key: string | null; video_r2_key: string | null }>(
    `SELECT id, headshot_r2_key, video_r2_key FROM applications WHERE cycle_id = '${c.id}'`
  );
  console.log(`  Cycle ${c.id} — ${apps.length} applications to purge.`);
  for (const a of apps) {
    if (a.headshot_r2_key) r2Delete('mdgh-applications', a.headshot_r2_key);
    if (a.video_r2_key) r2Delete('mdgh-applications', a.video_r2_key);
    d1Run(`DELETE FROM applications WHERE id = '${a.id}'`);
  }
  d1Run(`DELETE FROM cycles WHERE id = '${c.id}'`);
}

console.log(APPLY ? 'Done.' : 'Dry-run complete. Re-run with --apply to delete.');
