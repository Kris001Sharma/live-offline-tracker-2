export interface TraceEvent {
  id: string;
  timestamp: string;
  phase: string;
  result: string;
  data: Record<string, any>;
}

const MAX_EVENTS = 500;

const listeners = new Set<(events: TraceEvent[]) => void>();
let events: TraceEvent[] = [];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function notify(): void {
  for (const listener of listeners) {
    listener([...events]);
  }
}

export const DiagnosticTraceStore = {
  append(event: Omit<TraceEvent, 'id' | 'timestamp'>): void {
    const entry: TraceEvent = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...event
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) {
      events = events.slice(-MAX_EVENTS);
    }
    notify();
  },

  getEvents(): TraceEvent[] {
    return [...events];
  },

  clear(): void {
    events = [];
    notify();
  },

  subscribe(listener: (events: TraceEvent[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
