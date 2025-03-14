export interface SharedMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'failed';
  role: 'user' | 'assistant';
}

class MessageBus {
  private subscribers: ((message: SharedMessage) => void)[] = [];
  private messageHistory: SharedMessage[] = [];

  subscribe(callback: (message: SharedMessage) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  sendMessage(message: SharedMessage) {
    this.messageHistory.push(message);
    this.subscribers.forEach(callback => callback(message));
  }

  getMessageHistory(): SharedMessage[] {
    return this.messageHistory;
  }
}

export const messageBus = new MessageBus(); 