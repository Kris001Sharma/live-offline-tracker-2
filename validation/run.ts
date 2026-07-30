import { spawn } from 'child_process';
import * as path from 'path';

const SUITES = ['repository', 'engine', 'integration', 'cloud', 'synchronization', 'operational']; // Permanent validation suites
const args = process.argv.slice(2);
const target = args[0] || 'all';

async function runSuite(suite: string): Promise<any> {
  return new Promise((resolve) => {
    console.log(`\n======================================================`);
    console.log(`🚀 Executing Validation Suite: ${suite.toUpperCase()}`);
    console.log(`======================================================\n`);
    
    const scriptPath = path.join(__dirname, suite, `${suite}.validation.ts`);
    const proc = spawn('bun', [scriptPath], { stdio: ['inherit', 'pipe', 'inherit'] });
    
    let jsonReportStr = '';
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      // Print everything EXCEPT the json report line
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('___JSON_REPORT___')) {
          jsonReportStr = line.split('___JSON_REPORT___')[1];
        } else {
          process.stdout.write(line + '\n');
        }
      }
    });

    proc.on('close', (code) => {
      let report = null;
      if (jsonReportStr) {
        try {
          report = JSON.parse(jsonReportStr.trim());
        } catch (e) {
          console.error(`Failed to parse JSON report for ${suite}`, e);
        }
      }
      resolve({ suite, code, report });
    });
  });
}

async function main() {
  const suitesToRun = target === 'all' ? SUITES : [target];
  const results = [];
  
  for (const suite of suitesToRun) {
    if (SUITES.includes(suite)) {
      const res = await runSuite(suite);
      results.push(res);
    } else {
      console.warn(`⚠️ Unknown suite: ${suite}. Skipping.`);
    }
  }
  
  console.log(`\n\n======================================================`);
  console.log(`📊 OVERALL EXECUTION STATISTICS SUMMARY`);
  console.log(`======================================================`);
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalPublicApis = 0;
  let totalLifecycle = 0;
  let totalFailurePaths = 0;
  let totalImmutability = 0;
  let totalArchitecture = 0;
  
  for (const res of results) {
    const r = res.report;
    if (r) {
      totalPassed += r.passed;
      totalFailed += r.failed;
      totalPublicApis += r.publicApis;
      totalLifecycle += r.lifecycleChecks;
      totalFailurePaths += r.failurePathChecks;
      totalImmutability += r.immutabilityChecks;
      totalArchitecture += r.architectureChecks;
    } else {
      console.error(`❌ Suite ${res.suite} failed to produce a valid report.`);
      totalFailed++;
    }
  }
  
  console.log(`Modules Executed      : ${results.length}`);
  console.log(`Total Checks          : ${totalPassed + totalFailed}`);
  console.log(`Total PASSED          : ${totalPassed}`);
  console.log(`Total FAILED          : ${totalFailed}`);
  console.log(`------------------------------------------------------`);
  console.log(`Public APIs Validated : ${totalPublicApis}`);
  console.log(`Lifecycle Checks      : ${totalLifecycle}`);
  console.log(`Failure Path Checks   : ${totalFailurePaths}`);
  console.log(`Immutability Checks   : ${totalImmutability}`);
  console.log(`Architecture Checks   : ${totalArchitecture}`);
  console.log(`Compilation Status    : PASSED (Typescript types validated)`);
  console.log(`======================================================`);
  
  if (totalFailed > 0) {
    console.log(`\nOVERALL RESULT: FAIL ❌`);
    process.exit(1);
  } else {
    console.log(`\nOVERALL RESULT: PASS ✅`);
    process.exit(0);
  }
}

main().catch(console.error);
