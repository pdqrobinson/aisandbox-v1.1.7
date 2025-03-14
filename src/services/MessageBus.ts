import { Message, SharedMessage } from '../types/sandbox';

export type EventType = 'message' | 'task' | 'status' | 'capability' | 'control' | 'context_updated';
export type MessageRole = 'user' | 'assistant' | 'system' | 'control';

export interface EventMessage extends Omit<SharedMessage, 'role'> {
  eventType: EventType;
  topic?: string;
  capabilities?: string[];
  role: MessageRole;
}

class MessageBus {
  private subscribers: Map<string, Set<(message: EventMessage) => void>>;
  private topics: Map<string, Set<string>>;

  constructor() {
    this.subscribers = new Map();
    this.topics = new Map();
  }

  subscribe(nodeId: string, callback: (message: EventMessage) => void) {
    if (!this.subscribers.has(nodeId)) {
      this.subscribers.set(nodeId, new Set());
    }
    this.subscribers.get(nodeId)?.add(callback);
  }

  unsubscribe(nodeId: string, callback: (message: EventMessage) => void) {
    this.subscribers.get(nodeId)?.delete(callback);
  }

  subscribeTopic(nodeId: string, topic: string) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    this.topics.get(topic)?.add(nodeId);
  }

  unsubscribeTopic(nodeId: string, topic: string) {
    this.topics.get(topic)?.delete(nodeId);
  }

  emit(eventType: EventType, message: Omit<EventMessage, 'eventType'>) {
    const eventMessage: EventMessage = {
      ...message,
      eventType
    };

    // Direct message to specific receiver
    if (eventMessage.receiverId) {
      this.subscribers.get(eventMessage.receiverId)?.forEach(callback => {
        callback(eventMessage);
      });
    }

    // Broadcast to topic subscribers if topic is specified
    if (eventMessage.topic) {
      const topicSubscribers = this.topics.get(eventMessage.topic);
      if (topicSubscribers) {
        topicSubscribers.forEach(subscriberId => {
          if (subscriberId !== eventMessage.senderId) { // Don't send back to sender
            this.subscribers.get(subscriberId)?.forEach(callback => {
              callback(eventMessage);
            });
          }
        });
      }
    }

    // Special handling for context updates
    if (eventType === 'context_updated') {
      // Broadcast to all connected nodes
      this.subscribers.forEach((callbacks, nodeId) => {
        if (nodeId !== eventMessage.senderId) {
          callbacks.forEach(callback => {
            callback(eventMessage);
          });
        }
      });
    }
  }

  getSubscribers(nodeId: string) {
    return this.subscribers.get(nodeId) || new Set();
  }

  getTopicSubscribers(topic: string) {
    return this.topics.get(topic) || new Set();
  }

  // Helper method to broadcast control messages
  broadcastControl(content: string, metadata: Record<string, any> = {}) {
    this.emit('control', {
      id: `control-${Date.now()}`,
      senderId: 'system',
      content,
      type: 'command',
      timestamp: new Date(),
      metadata
    });
  }
}

export const messageBus = new MessageBus(); 