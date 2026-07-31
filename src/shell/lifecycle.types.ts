export type LifecycleState = 'NOT_INITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

export interface LifecycleStateModel {
  state: LifecycleState;
  error: string | null;
}

export interface LifecycleContextValue extends LifecycleStateModel {
  retry: () => void;
}
