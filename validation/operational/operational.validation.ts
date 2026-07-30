import { OperationalScenarioRunner } from './runner';
import { 
  OperationalSanityScenario, 
  OperationalAuthenticationScenario,
  OperationalAttendanceScenario,
  OperationalGPSScenario,
  OperationalLocalWorkdayScenario,
  OperationalOfflineSyncScenario
} from './scenarios';

async function runOperationalValidation() {
  const runner = new OperationalScenarioRunner();

  // Register operational scenarios
  runner.register(new OperationalSanityScenario());
  runner.register(new OperationalAuthenticationScenario());
  runner.register(new OperationalAttendanceScenario());
  runner.register(new OperationalGPSScenario());
  runner.register(new OperationalLocalWorkdayScenario());
  runner.register(new OperationalOfflineSyncScenario());

  // Execute all registered scenarios sequentially
  await runner.runAll();
}

runOperationalValidation().catch(err => {
  console.error('Fatal error during operational validation execution:', err);
  process.exit(1);
});
