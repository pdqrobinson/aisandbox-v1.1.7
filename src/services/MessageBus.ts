import { Message, SharedMessage, EventType as SandboxEventType, MessageType, EventMessage as SandboxEventMessage } from '../types/sandbox';

export type MessageRole = 'user' | 'assistant' | 'system' | 'control';
export type EventType = SandboxEventType;
export interface EventMessage extends SharedMessage {
  eventType: EventType;
  topic?: string;
}

interface Subscription {
  nodeId: string;
  eventTypes: Set<EventType>;
  callback: (message: EventMessage) => void;
}

class MessageBus {
  private subscriptions: Subscription[];
  private topics: Map<string, Set<string>>;

  constructor() {
    this.subscriptions = [];
    this.topics = new Map();
  }

  subscribe(
    nodeId: string, 
    eventTypesOrCallback: EventType[] | ((message: EventMessage) => void),
    callback?: (message: EventMessage) => void
  ): () => void {
    let eventTypes: EventType[] = [];
    let messageCallback: (message: EventMessage) => void;

    if (typeof eventTypesOrCallback === 'function') {
      messageCallback = eventTypesOrCallback;
      eventTypes = ['message', 'task', 'status', 'capability', 'control', 'context_updated'];
    } else {
      eventTypes = eventTypesOrCallback;
      messageCallback = callback!;
    }

    const subscription: Subscription = {
      nodeId,
      eventTypes: new Set(eventTypes),
      callback: messageCallback
    };
    
    this.subscriptions.push(subscription);
    
    // Return unsubscribe function
    return () => {
      this.subscriptions = this.subscriptions.filter(sub => 
        sub.nodeId !== nodeId || sub.callback !== messageCallback
      );
    };
  }

  subscribeTopic(nodeId: string, topic: string) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    this.topics.get(topic)?.add(nodeId);
    
    return () => this.unsubscribeTopic(nodeId, topic);
  }

  unsubscribeTopic(nodeId: string, topic: string) {
    this.topics.get(topic)?.delete(nodeId);
    if (this.topics.get(topic)?.size === 0) {
      this.topics.delete(topic);
    }
  }

  emit(eventType: EventType, message: Omit<SharedMessage, 'eventType'>) {
    const eventMessage: EventMessage = {
      ...message,
      eventType,
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: message.senderId,
      receiverId: message.receiverId,
      from: message.from || message.senderId,
      to: message.to || message.receiverId || '',
      content: message.content,
      type: message.type,
      timestamp: message.timestamp || new Date(),
      status: message.status || 'sent',
      metadata: {
        ...message.metadata,
        emittedAt: Date.now(),
        topic: (message as any).topic
      }
    };

    // Find all relevant subscribers
    const relevantSubscriptions = this.subscriptions.filter(sub => {
      // Check if subscriber is interested in this event type
      if (!sub.eventTypes.has(eventType)) {
        return false;
      }

      // Don't send message back to sender
      if (sub.nodeId === eventMessage.senderId) {
        return false;
      }

      // If message has a specific receiver, only send to that receiver
      if (eventMessage.receiverId && sub.nodeId !== eventMessage.receiverId) {
        return false;
      }

      // If message has a topic, check if subscriber is interested in that topic
      const topic = eventMessage.metadata?.topic;
      if (topic) {
        const topicSubscribers = this.topics.get(topic);
        return topicSubscribers?.has(sub.nodeId) ?? false;
      }

      return true;
    });

    // Notify all relevant subscribers
    relevantSubscriptions.forEach(sub => {
      try {
        sub.callback(eventMessage);
      } catch (error) {
        console.error(`Error delivering message to node ${sub.nodeId}:`, error);
      }
    });

    return eventMessage;
  }

  // Helper method to broadcast control messages
  broadcastControl(content: string, metadata: Record<string, any> = {}) {
    return this.emit('control', {
      id: `control-${Date.now()}`,
      senderId: 'system',
      receiverId: undefined,
      from: 'system',
      to: '',
      content,
      type: 'command',
      timestamp: new Date(),
      status: 'sent',
      metadata: {
        ...metadata,
        isSystemMessage: true
      }
    });
  }

  // Get all nodes subscribed to a specific event type
  getSubscribersForEventType(eventType: EventType): string[] {
    return this.subscriptions
      .filter(sub => sub.eventTypes.has(eventType))
      .map(sub => sub.nodeId);
  }

  // Get all nodes subscribed to a specific topic
  getTopicSubscribers(topic: string): string[] {
    return Array.from(this.topics.get(topic) || []);
  }
}

export const messageBus = new MessageBus(); 