import { App } from '@capacitor/app';
import { ExecutionState, ExecutionStatus } from './background.types';
import { TrackingSession } from '../tracking-session';

let currentState: ExecutionState = ExecutionState.STOPPED;
let lastError: string | undefined;
let appStateListener: any;

export const BackgroundExecution = {
  initialize(): void {
    if (appStateListener) {
      appStateListener.remove();
      appStateListener = undefined;
    }
    currentState = ExecutionState.STOPPED;
    lastError = undefined;
  },

  async start(): Promise<void> {
    if (currentState !== ExecutionState.STOPPED) {
      throw new Error(`Background Execution: Cannot start from state ${currentState}`);
    }

    currentState = ExecutionState.STARTING;

    try {
      await TrackingSession.start();

      appStateListener = await App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          BackgroundExecution.onAppForeground();
        } else {
          BackgroundExecution.onAppBackground();
        }
      });

      currentState = ExecutionState.ACTIVE;
      lastError = undefined;
    } catch (error) {
      currentState = ExecutionState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  },

  async stop(): Promise<void> {
    if (
      currentState !== ExecutionState.ACTIVE &&
      currentState !== ExecutionState.BACKGROUND
    ) {
      throw new Error(`Background Execution: Cannot stop from state ${currentState}`);
    }

    currentState = ExecutionState.STOPPING;

    try {
      if (appStateListener) {
        await appStateListener.remove();
        appStateListener = undefined;
      }

      await TrackingSession.stop();

      currentState = ExecutionState.STOPPED;
    } catch (error) {
      currentState = ExecutionState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  },

  onAppForeground(): void {
    if (currentState === ExecutionState.BACKGROUND) {
      currentState = ExecutionState.ACTIVE;
    }
  },

  onAppBackground(): void {
    if (currentState === ExecutionState.ACTIVE) {
      currentState = ExecutionState.BACKGROUND;
    }
  },

  status(): ExecutionStatus {
    return {
      state: currentState,
      lastError
    };
  }
};
