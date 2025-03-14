import { EventMessage, EventType, MessageType } from '../types/sandbox';
import { messageBus } from './MessageBus';

export interface NodeCapability {
  type: string;
  metadata?: Record<string, any>;
}

export interface NodeConnection {
  nodeId: string;
  established: number;
  active: boolean;
  capabilities: NodeCapability[];
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export class NodeCommunicationService {
  private static instance: NodeCommunicationService;
  private connections: Map<string, NodeConnection>;
  private messageHistory: Map<string, EventMessage[]>;
  private subscriptions: Map<string, (() => void)[]>;

  private constructor() {
    this.connections = new Map();
    this.messageHistory = new Map();
    this.subscriptions = new Map();
  }

  public static getInstance(): NodeCommunicationService {
    if (!NodeCommunicationService.instance) {
      NodeCommunicationService.instance = new NodeCommunicationService();
    }
    return NodeCommunicationService.instance;
  }

  public subscribeToEvents(
    nodeId: string,
    eventTypes: EventType[],
    callback: (message: EventMessage) => void
  ): () => void {
    // Subscribe to message bus
    const unsubscribe = messageBus.subscribe(nodeId, eventTypes, callback);
    
    // Store unsubscribe function
    if (!this.subscriptions.has(nodeId)) {
      this.subscriptions.set(nodeId, []);
    }
    this.subscriptions.get(nodeId)?.push(unsubscribe);
    
    return unsubscribe;
  }

  public subscribeToTopic(nodeId: string, topic: string): () => void {
    const unsubscribe = messageBus.subscribeTopic(nodeId, topic);
    
    if (!this.subscriptions.has(nodeId)) {
      this.subscriptions.set(nodeId, []);
    }
    this.subscriptions.get(nodeId)?.push(unsubscribe);
    
    return unsubscribe;
  }

  public async sendMessage(
    eventType: EventType,
    message: Partial<EventMessage>
  ): Promise<EventMessage> {
    try {
      // Check if receiver is connected (if specified)
      if (message.receiverId && !this.connections.has(message.receiverId)) {
        throw new Error(`Receiver ${message.receiverId} is not connected`);
      }

      const fullMessage = {
        id: this.generateMessageId(),
        senderId: message.senderId || 'system',
        receiverId: message.receiverId,
        content: message.content || '',
        type: message.type || 'command',
        timestamp: new Date(),
        metadata: {
          ...message.metadata,
          sentAt: Date.now(),
          topic: message.metadata?.topic
        }
      };

      const sentMessage = messageBus.emit(eventType, fullMessage);
      this.updateMessageHistory(message.senderId || 'system', sentMessage);
      return sentMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: EventMessage = {
        id: this.generateMessageId(),
        senderId: message.senderId || 'system',
        content: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
        timestamp: new Date(),
        eventType: 'status',
        metadata: {
          error: true,
          originalMessage: message
        }
      };
      this.updateMessageHistory(message.senderId || 'system', errorMessage);
      throw error;
    }
  }

  public establishConnection(nodeId: string, capabilities: NodeCapability[] = []): void {
    const connection: NodeConnection = {
      nodeId,
      established: Date.now(),
      active: true,
      capabilities
    };
    
    this.connections.set(nodeId, connection);
    
    // Notify other nodes about the new connection
    this.sendMessage('status', {
      senderId: 'system',
      content: 'node_connected',
      type: 'command',
      metadata: {
        nodeId,
        capabilities
      }
    }).catch(error => {
      console.error('Error notifying about new connection:', error);
    });
  }

  public removeConnection(nodeId: string): void {
    // Clean up all subscriptions
    const unsubscribeFunctions = this.subscriptions.get(nodeId) || [];
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.delete(nodeId);
    
    // Remove connection
    this.connections.delete(nodeId);
    
    // Notify other nodes
    this.sendMessage('status', {
      senderId: 'system',
      content: 'node_disconnected',
      type: 'command',
      metadata: { nodeId }
    }).catch(error => {
      console.error('Error notifying about node disconnection:', error);
    });
  }

  public getConnectedNodes(): NodeConnection[] {
    return Array.from(this.connections.values());
  }

  public getNodeCapabilities(nodeId: string): NodeCapability[] {
    return this.connections.get(nodeId)?.capabilities || [];
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMessageHistory(nodeId: string, message: EventMessage): void {
    if (!this.messageHistory.has(nodeId)) {
      this.messageHistory.set(nodeId, []);
    }
    this.messageHistory.get(nodeId)?.push(message);

    // Limit history size to prevent memory issues
    const history = this.messageHistory.get(nodeId);
    if (history && history.length > 1000) {
      this.messageHistory.set(nodeId, history.slice(-1000));
    }
  }

  public getMessageHistory(nodeId: string): EventMessage[] {
    return this.messageHistory.get(nodeId) || [];
  }
} 