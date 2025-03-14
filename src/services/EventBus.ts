import { v4 as uuidv4 } from 'uuid';

export type EventType = 'message' | 'update' | 'delete' | 'connect' | 'disconnect';

export interface Event {
  id: string;
  type: EventType;
  source: string;
  target?: string;
  payload: any;
  timestamp: number;
}

type EventCallback = (event: Event) => void;

interface Subscription {
  id: string;
  nodeId: string;
  eventTypes: EventType[];
  callback: EventCallback;
}

class EventBus {
  private static instance: EventBus;
  private subscriptions: Map<string, Subscription>;

  private constructor() {
    this.subscriptions = new Map();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe(
    nodeId: string,
    eventTypes: EventType[],
    callback: EventCallback
  ): () => void {
    const subscriptionId = uuidv4();
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      nodeId,
      eventTypes,
      callback,
    });

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
    };
  }

  public emit(event: Omit<Event, 'id' | 'timestamp'>): void {
    const fullEvent: Event = {
      ...event,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    // Find all relevant subscriptions and notify them
    this.subscriptions.forEach((subscription) => {
      if (
        subscription.eventTypes.includes(event.type) &&
        (event.target === undefined || // Broadcast event
          event.target === subscription.nodeId || // Direct target
          event.source === subscription.nodeId) // Source node
      ) {
        try {
          subscription.callback(fullEvent);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      }
    });
  }

  public getActiveSubscribers(): string[] {
    const subscribers = new Set<string>();
    this.subscriptions.forEach((sub) => subscribers.add(sub.nodeId));
    return Array.from(subscribers);
  }
}

export const eventBus = EventBus.getInstance(); 