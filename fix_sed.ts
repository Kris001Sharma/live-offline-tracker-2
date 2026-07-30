import fs from 'fs';
let content = fs.readFileSync('validation/repository/bun-sqlite.adapter.ts', 'utf8');
content = content.replace("console.log('SQL:', upperQuery, params, 'ROWS:', rows); console.log('SQL:', upperQuery, params, 'CHANGES:', res.changes); return { rows };", "console.log('SQL:', upperQuery, params, 'ROWS:', rows); return { rows };");
fs.writeFileSync('validation/repository/bun-sqlite.adapter.ts', content);
