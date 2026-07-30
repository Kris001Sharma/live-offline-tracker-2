import fs from 'fs';
const p = 'validation/repository/repository.validation.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/console\.log\('\\n=== VALIDATION SUMMARY ==='\);[\s\S]*?process\.exit\(0\);\n\s*\}/m, "report('Repository');\n  }");
fs.writeFileSync(p, c);
