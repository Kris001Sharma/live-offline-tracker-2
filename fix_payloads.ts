import fs from 'fs';
let content = fs.readFileSync('validation/repository/repository.validation.ts', 'utf8');

content = content.replace(
  "started_at: new Date().toISOString()",
  "started_at: new Date().toISOString(),\n    status: 'ACTIVE'"
);

content = content.replace(
  "shift_id: 's1'",
  "shift_id: 's1',\n    sync_status: 'PENDING',\n    sync_retry_count: 0"
);

fs.writeFileSync('validation/repository/repository.validation.ts', content);
