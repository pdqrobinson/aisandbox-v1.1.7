import { Message, SharedMessage } from '../types/sandbox';

export type { SharedMessage };

class MessageBus {
  private subscribers: ((message: SharedMessage) => void)[] = [];

  subscribe(callback: (message: SharedMessage) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  async sendMessage(message: Message | SharedMessage) {
    // Ensure message has all required fields for SharedMessage
    const sharedMessage: SharedMessage = {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      from: message.from || 'system',
      to: message.to || 'all',
      status: message.status || 'sent',
      metadata: message.metadata
    };

    // Notify all subscribers
    this.subscribers.forEach(callback => callback(sharedMessage));
  }
}

export const messageBus = new MessageBus(); 