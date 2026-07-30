export type ScenarioPhase = 'SETUP' | 'EXECUTE' | 'VERIFY' | 'CLEANUP';

export interface PhaseResult {
  phase: ScenarioPhase;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  durationMs: number;
  phaseResults: PhaseResult[];
  assertionsPassed: number;
  assertionsFailed: number;
  error?: string;
}

export interface OperationalScenario {
  id: string;
  title: string;
  description: string;
  setup(): Promise<void>;
  execute(): Promise<void>;
  verify(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface OperationalExecutionSummary {
  scenariosExecuted: number;
  scenariosPassed: number;
  scenariosFailed: number;
  scenariosSkipped: number;
  totalAssertionsPassed: number;
  totalAssertionsFailed: number;
  totalDurationMs: number;
  scenarioResults: ScenarioResult[];
  overallStatus: 'PASS' | 'FAIL';
}

export class OperationalHarness {
  public static currentScenarioId: string | null = null;
  public static scenarioAssertionsPassed = 0;
  public static scenarioAssertionsFailed = 0;
  public static totalAssertionsPassed = 0;
  public static totalAssertionsFailed = 0;

  public static resetScenarioStats(scenarioId: string) {
    this.currentScenarioId = scenarioId;
    this.scenarioAssertionsPassed = 0;
    this.scenarioAssertionsFailed = 0;
  }

  public static recordAssertion(passed: boolean) {
    if (passed) {
      this.scenarioAssertionsPassed++;
      this.totalAssertionsPassed++;
    } else {
      this.scenarioAssertionsFailed++;
      this.totalAssertionsFailed++;
    }
  }
}
