/**
 * Simple execution tracer for the trusted device → Supabase synchronization flow.
 * Tracks execution boundaries for diagnostic purposes.
 */

export interface SyncStep {
  id: number;
  name: string;
  started: boolean;
  result: 'SUCCESS' | 'FAILED' | undefined;
  error?: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  data?: Record<string, any>;
}

export class TrustedDeviceSliceTracer {
  private steps: SyncStep[] = [];
  private readonly totalSteps = 8;

  constructor() {
    this.initializeSteps();
  }

  private initializeSteps(): void {
    this.steps = [
      { id: 1, name: 'syncStarted', started: false, result: undefined },
      { id: 2, name: 'authenticationResolved', started: false, result: undefined },
      { id: 3, name: 'localWorkerResolved', started: false, result: undefined },
      { id: 4, name: 'localTrustedDeviceResolved', started: false, result: undefined },
      { id: 5, name: 'remoteWorkerLookup', started: false, result: undefined },
      { id: 6, name: 'trustedDeviceUpload', started: false, result: undefined },
      { id: 7, name: 'markSynced', started: false, result: undefined },
      { id: 8, name: 'syncCompleted', started: false, result: undefined }
    ];
  }

  /**
   * Mark a step as started
   */
  startStep(stepId: number): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.started = true;
      step.result = undefined;
      step.error = undefined;
      step.data = undefined;
    }
  }

  /**
   * Mark a step as completed successfully
   */
  completeStep(stepId: number, data?: Record<string, any>): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.result = 'SUCCESS';
      step.data = data;
    }
  }

  /**
   * Mark a step as failed
   */
  failStep(stepId: number, error: any): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.result = 'FAILED';
      if (error instanceof Error) {
        step.error = {
          message: error.message,
          // Try to extract additional error info if available
          ...(error as any).code && { code: (error as any).code },
          ...(error as any).details && { details: (error as any).details },
          ...(error as any).hint && { hint: (error as any).hint }
        };
      } else {
        step.error = {
          message: String(error)
        };
      }
    }
  }

  /**
   * Get the result of a specific step
   */
  getStepResult(stepId: number): 'SUCCESS' | 'FAILED' | undefined {
    const step = this.steps.find(s => s.id === stepId);
    return step ? step.result : undefined;
  }

  /**
   * Get the current step that is started but not yet completed
   */
  getCurrentStep(): SyncStep | undefined {
    return this.steps.find(s => s.started && !s.result);
  }

  /**
   * Get the current trace state
   */
  getTrace(): SyncStep[] {
    return [...this.steps];
  }

  /**
   * Reset the tracer
   */
  reset(): void {
    this.initializeSteps();
  }

  /**
   * Format the trace for display in diagnostic screen
   */
  formatTrace(): string {
    const lines = ['TRUSTED DEVICE SYNC TRACE'];

    for (const step of this.steps) {
      lines.push(`${step.id}. ${step.name}`);
      lines.push(`   Started: ${step.started ? 'YES' : 'NO'}`);

      if (step.result) {
        lines.push(`   Result: ${step.result}`);

        // Add step-specific data
        switch (step.id) {
          case 2: // authenticationResolved
            if (step.data?.authUserId) {
              lines.push(`   authUserId: ${step.data.authUserId}`);
            }
            break;
          case 3: // localWorkerResolved
            if (step.data?.workerId) {
              lines.push(`   workerId: ${step.data.workerId}`);
            }
            if (step.data?.identityMatch !== undefined) {
              lines.push(`   identityMatch: ${step.data.identityMatch ? 'YES' : 'NO'}`);
            }
            break;
          case 4: // localTrustedDeviceResolved
            if (step.data?.trustedDeviceId) {
              lines.push(`   trustedDeviceId: ${step.data.trustedDeviceId}`);
            }
            if (step.data?.workerId) {
              lines.push(`   workerId: ${step.data.workerId}`);
            }
            if (step.data?.deviceId) {
              lines.push(`   deviceId: ${step.data.deviceId}`);
            }
            if (step.data?.status) {
              lines.push(`   status: ${step.data.status}`);
            }
            if (step.data?.syncStatus) {
              lines.push(`   syncStatus: ${step.data.syncStatus}`);
            }
            break;
          case 5: // remoteWorkerLookup
            if (step.data?.workerFound !== undefined) {
              lines.push(`   workerFound: ${step.data.workerFound ? 'YES' : 'NO'}`);
            }
            break;
          case 6: // trustedDeviceUpload
            // Success case doesn't need additional data beyond Result: SUCCESS
            break;
          case 7: // markSynced
            // Success case doesn't need additional data beyond Result: SUCCESS
            break;
          case 8: // syncCompleted
            // Success case doesn't need additional data beyond Result: SUCCESS
            break;
        }

        // Add error information if failed
        if (step.result === 'FAILED' && step.error) {
          lines.push(`   Error:`);
          if (step.error.code) {
            lines.push(`      code: ${step.error.code}`);
          }
          if (step.error.message) {
            lines.push(`      message: ${step.error.message}`);
          }
          if (step.error.details) {
            lines.push(`      details: ${step.error.details}`);
          }
          if (step.error.hint) {
            lines.push(`      hint: ${step.error.hint}`);
          }
        }
      } else if (!step.started) {
        lines.push(`   Result: NOT_EXECUTED`);
      }

      lines.push(''); // Empty line for readability
    }

    return lines.join('\n');
  }
}

// Export a singleton instance for use in the synchronization flow
export const trustedDeviceSliceTracer = new TrustedDeviceSliceTracer();