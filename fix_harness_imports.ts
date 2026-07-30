import fs from 'fs';

function updateFile(filePath: string, isEngine: boolean) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove local HARNESS and assert definitions
  content = content.replace(/const HARNESS = {[\s\S]*?errors: \[\] as string\[\]\n};\n/m, '');
  content = content.replace(/function assert\(condition: boolean, message: string\) {[\s\S]*?HARNESS\.errors\.push\(message\);\n  }\n}\n/m, '');

  // Prepend import
  const importPath = isEngine ? '../framework' : '../framework';
  content = `import { assert, report } from '${importPath}';\n` + content;

  // Replace manual summaries at the end
  if (isEngine) {
    content = content.replace(/console\.log\('\\n=== VALIDATION SUMMARY ==='\);[\s\S]*?process\.exit\(0\);\n}/m, "report('Engine');\n}");
  } else {
    content = content.replace(/console\.log\('\\n=== VALIDATION SUMMARY ==='\);[\s\S]*?process\.exit\(0\);\n}/m, "report('Repository');\n}");
  }

  fs.writeFileSync(filePath, content);
}

updateFile('validation/engine/engine.validation.ts', true);
updateFile('validation/repository/repository.validation.ts', false);
