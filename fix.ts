import fs from 'fs';
let c = fs.readFileSync('validation/repository/repository.validation.ts', 'utf8');
c = c.replace("report('Repository');\n  }\n  } catch", "report('Repository');\n  } catch");
fs.writeFileSync('validation/repository/repository.validation.ts', c);
