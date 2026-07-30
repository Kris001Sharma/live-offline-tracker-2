export const HARNESS = {
  passed: 0,
  failed: 0,
  errors: [] as string[],
  publicApis: 0,
  lifecycleChecks: 0,
  failurePathChecks: 0,
  immutabilityChecks: 0,
  architectureChecks: 0
};

export type Category = 'API' | 'LIFECYCLE' | 'FAILURE' | 'IMMUTABLE' | 'ARCHITECTURE';

function detectCategory(message: string): Category {
  const msg = message.toLowerCase();
  if (msg.includes('immutable') || msg.includes('deep frozen') || msg.includes('frozen')) return 'IMMUTABLE';
  if (msg.includes('fail') || msg.includes('catch') || msg.includes('bad') || msg.includes('throw') || msg.includes('error')) return 'FAILURE';
  if (msg.includes('idempotent') || msg.includes('initial state') || msg.includes('lifecycle') || msg.includes('reset') || msg.includes('after initialization')) return 'LIFECYCLE';
  if (msg.includes('architecture') || msg.includes('decoupled') || msg.includes('boundary') || msg.includes('internal')) return 'ARCHITECTURE';
  return 'API';
}

export function assert(condition: boolean, message: string, explicitCategory?: Category) {
  const category = explicitCategory || detectCategory(message);
  
  if (condition) {
    HARNESS.passed++;
    switch (category) {
      case 'API': HARNESS.publicApis++; break;
      case 'LIFECYCLE': HARNESS.lifecycleChecks++; break;
      case 'FAILURE': HARNESS.failurePathChecks++; break;
      case 'IMMUTABLE': HARNESS.immutabilityChecks++; break;
      case 'ARCHITECTURE': HARNESS.architectureChecks++; break;
    }
    console.log(`✅ PASS [${category}]: ${message}`);
  } else {
    HARNESS.failed++;
    console.error(`❌ FAIL [${category}]: ${message}`);
    HARNESS.errors.push(`[${category}] ${message}`);
  }
}

export function report(moduleName: string) {
  console.log(`\n=== VALIDATION SUMMARY FOR ${moduleName} ===`);
  console.log(`Passed: ${HARNESS.passed}`);
  console.log(`Failed: ${HARNESS.failed}`);
  console.log(`API Checks: ${HARNESS.publicApis}`);
  console.log(`Lifecycle Checks: ${HARNESS.lifecycleChecks}`);
  console.log(`Failure Path Checks: ${HARNESS.failurePathChecks}`);
  console.log(`Immutability Checks: ${HARNESS.immutabilityChecks}`);
  console.log(`Architecture Checks: ${HARNESS.architectureChecks}`);
  
  if (HARNESS.failed > 0) {
    console.log('Errors:', HARNESS.errors);
  }
  
  console.log(`\n___JSON_REPORT___${JSON.stringify({
    moduleName,
    passed: HARNESS.passed,
    failed: HARNESS.failed,
    publicApis: HARNESS.publicApis,
    lifecycleChecks: HARNESS.lifecycleChecks,
    failurePathChecks: HARNESS.failurePathChecks,
    immutabilityChecks: HARNESS.immutabilityChecks,
    architectureChecks: HARNESS.architectureChecks,
    errors: HARNESS.errors
  })}`);
  
  if (HARNESS.failed > 0) {
    process.exit(1);
  }
}
