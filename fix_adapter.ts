import fs from 'fs';
let content = fs.readFileSync('validation/repository/bun-sqlite.adapter.ts', 'utf8');

content = content.replace(
  "worker_id TEXT NOT NULL,\n          shift_id TEXT\n      );",
  "worker_id TEXT NOT NULL,\n          shift_id TEXT,\n          sync_status TEXT NOT NULL,\n          sync_retry_count INTEGER NOT NULL,\n          sync_last_error TEXT,\n          sync_last_attempt_at TEXT\n      );"
);

fs.writeFileSync('validation/repository/bun-sqlite.adapter.ts', content);
