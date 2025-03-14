import { Message } from '../types/nodes';

export interface NodeConnection {
  nodeId: string;
  established: number;
  active: boolean;
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface NodeMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'direct' | 'broadcast';
  status: MessageStatus;
  metadata: {
    role: 'user' | 'assistant';
    processingInstructions?: string;
    [key: string]: any;
  };
}

export class NodeCommunicationService {
  private static instance: NodeCommunicationService;
  private subscribers: Map<string, (message: NodeMessage) => void>;
  private connections: Map<string, NodeConnection>;
  private messageHistory: Map<string, NodeMessage[]>;

  private constructor() {
    this.subscribers = new Map();
    this.connections = new Map();
    this.messageHistory = new Map();
  }

  public static getInstance(): NodeCommunicationService {
    if (!NodeCommunicationService.instance) {
      NodeCommunicationService.instance = new NodeCommunicationService();
    }
    return NodeCommunicationService.instance;
  }

  public subscribe(nodeId: string, callback: (message: NodeMessage) => void): () => void {
    this.subscribers.set(nodeId, callback);
    return () => {
      this.subscribers.delete(nodeId);
    };
  }

  public unsubscribe(nodeId: string): void {
    this.subscribers.delete(nodeId);
  }

  public async sendMessage(message: Omit<NodeMessage, 'id' | 'timestamp' | 'status'>): Promise<NodeMessage> {
    const fullMessage: NodeMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
      status: 'sent'
    };

    // If it's a direct message, check if the target node is connected
    if (message.type === 'direct' && message.to !== '*') {
      const connection = this.connections.get(message.to);
      if (!connection) {
        fullMessage.status = 'failed';
        this.updateMessageHistory(fullMessage);
        return fullMessage;
      }
    }

    // Notify subscribers
    if (message.to === '*') {
      // Broadcast to all connected nodes
      this.subscribers.forEach((callback, nodeId) => {
        if (nodeId !== message.from) {
          callback(fullMessage);
        }
      });
    } else {
      // Send to specific node
      const targetCallback = this.subscribers.get(message.to);
      if (targetCallback) {
        targetCallback(fullMessage);
      }
    }

    fullMessage.status = 'delivered';
    this.updateMessageHistory(fullMessage);
    return fullMessage;
  }

  public establishConnection(connection: NodeConnection): void {
    this.connections.set(connection.nodeId, connection);
  }

  public removeConnection(nodeId: string): void {
    this.connections.delete(nodeId);
  }

  public getConnectedNodes(): NodeConnection[] {
    return Array.from(this.connections.values());
  }

  private generateMessageId(): string {
    const timestamp = Date.now();
    const id = `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    return id;
  }

  private updateMessageHistory(message: NodeMessage): void {
    const history = this.messageHistory.get(message.from) || [];
    const updatedHistory = [...history, message];
    this.messageHistory.set(message.from, updatedHistory);
  }
} 