import {
  OperationalScenario,
  OperationalExecutionSummary,
  ScenarioResult,
  PhaseResult,
  ScenarioPhase,
  OperationalHarness
} from './framework';

export class OperationalScenarioRunner {
  private scenarios: OperationalScenario[] = [];

  public register(scenario: OperationalScenario): this {
    this.scenarios.push(scenario);
    return this;
  }

  public async runAll(): Promise<OperationalExecutionSummary> {
    console.log(`\n======================================================`);
    console.log(`🚀 OPERATIONAL VALIDATION SCENARIO RUNNER`);
    console.log(`Executing ${this.scenarios.length} business operational scenario(s)...`);
    console.log(`======================================================\n`);

    const overallStart = Date.now();
    const scenarioResults: ScenarioResult[] = [];
    let scenariosPassed = 0;
    let scenariosFailed = 0;
    let scenariosSkipped = 0;

    for (const scenario of this.scenarios) {
      console.log(`\n--- [Scenario ${scenario.id}]: ${scenario.title} ---`);
      console.log(`Description: ${scenario.description}`);

      OperationalHarness.resetScenarioStats(scenario.id);
      const scenarioStart = Date.now();
      const phaseResults: PhaseResult[] = [];
      let scenarioFailed = false;
      let scenarioError: string | undefined;

      const phases: { phase: ScenarioPhase; action: () => Promise<void> }[] = [
        { phase: 'SETUP', action: () => scenario.setup() },
        { phase: 'EXECUTE', action: () => scenario.execute() },
        { phase: 'VERIFY', action: () => scenario.verify() },
        { phase: 'CLEANUP', action: () => scenario.cleanup() }
      ];

      for (const p of phases) {
        const phaseStart = Date.now();
        console.log(`\n  ▶ Phase: ${p.phase}`);
        try {
          await p.action();
          const phaseDuration = Date.now() - phaseStart;
          phaseResults.push({
            phase: p.phase,
            success: true,
            durationMs: phaseDuration
          });
          console.log(`  ✔ Phase ${p.phase} PASSED (${phaseDuration}ms)`);
        } catch (err: any) {
          const phaseDuration = Date.now() - phaseStart;
          scenarioFailed = true;
          scenarioError = err?.message || String(err);
          phaseResults.push({
            phase: p.phase,
            success: false,
            durationMs: phaseDuration,
            error: scenarioError
          });
          console.error(`  ✖ Phase ${p.phase} FAILED (${phaseDuration}ms): ${scenarioError}`);
          // On phase failure, attempt cleanup phase if not already in cleanup
          if (p.phase !== 'CLEANUP') {
            try {
              console.log(`  ▶ Emergency Phase: CLEANUP`);
              const cleanupStart = Date.now();
              await scenario.cleanup();
              phaseResults.push({
                phase: 'CLEANUP',
                success: true,
                durationMs: Date.now() - cleanupStart
              });
            } catch (cleanupErr: any) {
              phaseResults.push({
                phase: 'CLEANUP',
                success: false,
                durationMs: 0,
                error: cleanupErr?.message || String(cleanupErr)
              });
            }
          }
          break; // Stop remaining phases for this failing scenario
        }
      }

      const scenarioDuration = Date.now() - scenarioStart;
      const status = scenarioFailed ? 'FAIL' : 'PASS';

      if (scenarioFailed) {
        scenariosFailed++;
      } else {
        scenariosPassed++;
      }

      scenarioResults.push({
        id: scenario.id,
        title: scenario.title,
        status,
        durationMs: scenarioDuration,
        phaseResults,
        assertionsPassed: OperationalHarness.scenarioAssertionsPassed,
        assertionsFailed: OperationalHarness.scenarioAssertionsFailed,
        error: scenarioError
      });

      console.log(`\n=== Scenario ${scenario.id} Result: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'} (${scenarioDuration}ms) ===`);
    }

    const totalDuration = Date.now() - overallStart;
    const overallStatus = scenariosFailed === 0 ? 'PASS' : 'FAIL';

    const summary: OperationalExecutionSummary = {
      scenariosExecuted: this.scenarios.length,
      scenariosPassed,
      scenariosFailed,
      scenariosSkipped,
      totalAssertionsPassed: OperationalHarness.totalAssertionsPassed,
      totalAssertionsFailed: OperationalHarness.totalAssertionsFailed,
      totalDurationMs: totalDuration,
      scenarioResults,
      overallStatus
    };

    this.printSummary(summary);
    return summary;
  }

  private printSummary(summary: OperationalExecutionSummary): void {
    console.log(`\n\n======================================================`);
    console.log(`📊 OPERATIONAL VALIDATION EXECUTION SUMMARY`);
    console.log(`======================================================`);
    console.log(`Scenarios Executed     : ${summary.scenariosExecuted}`);
    console.log(`Scenarios PASSED       : ${summary.scenariosPassed}`);
    console.log(`Scenarios FAILED       : ${summary.scenariosFailed}`);
    console.log(`Scenarios SKIPPED      : ${summary.scenariosSkipped}`);
    console.log(`------------------------------------------------------`);
    console.log(`Assertions PASSED      : ${summary.totalAssertionsPassed}`);
    console.log(`Assertions FAILED      : ${summary.totalAssertionsFailed}`);
    console.log(`Total Duration         : ${summary.totalDurationMs}ms`);
    console.log(`Overall Result         : ${summary.overallStatus === 'PASS' ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`======================================================\n`);

    // Output JSON report string for run.ts integration
    console.log(`___JSON_REPORT___${JSON.stringify({
      moduleName: 'OperationalValidation',
      passed: summary.totalAssertionsPassed,
      failed: summary.totalAssertionsFailed,
      scenariosPassed: summary.scenariosPassed,
      scenariosFailed: summary.scenariosFailed,
      publicApis: summary.totalAssertionsPassed,
      lifecycleChecks: summary.scenariosExecuted,
      failurePathChecks: summary.scenariosFailed,
      immutabilityChecks: 0,
      architectureChecks: 0,
      errors: summary.scenarioResults.filter(s => s.status === 'FAIL').map(s => `[${s.id}] ${s.error}`)
    })}`);

    if (summary.overallStatus === 'FAIL') {
      process.exit(1);
    }
  }
}
