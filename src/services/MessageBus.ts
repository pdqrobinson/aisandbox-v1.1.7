import { Message, SharedMessage, EventType as SandboxEventType, MessageType, EventMessage as SandboxEventMessage } from '../types/sandbox';

export type MessageRole = 'user' | 'assistant' | 'system' | 'control';
export type EventType = 
  | 'message' 
  | 'update' 
  | 'connect' 
  | 'disconnect' 
  | 'node_created' 
  | 'node_deleted' 
  | 'content_updated' 
  | 'context_updated' 
  | 'capability_updated';

export interface EventMessage extends SharedMessage {
  eventType: EventType;
  topic?: string;
  metadata?: {
    nodeType?: string;
    nodeId?: string;
    content?: any;
    capabilities?: any[];
    connectedNodes?: string[];
    timestamp?: number;
    action?: string;
    [key: string]: any;
  };
}

interface Subscription {
  nodeId: string;
  eventTypes: Set<EventType>;
  callback: (message: EventMessage) => void;
}

class MessageBus {
  private subscriptions: Subscription[];
  private topics: Map<string, Set<string>>;
  private nodeConnections: Map<string, Set<string>>;
  private nodeContents: Map<string, any>;
  private contextUpdateTimeouts: Map<string, NodeJS.Timeout>;
  private lastContextUpdate: Map<string, number>;

  constructor() {
    this.subscriptions = [];
    this.topics = new Map();
    this.nodeConnections = new Map();
    this.nodeContents = new Map();
    this.contextUpdateTimeouts = new Map();
    this.lastContextUpdate = new Map();
  }

  subscribe(
    nodeId: string, 
    eventTypesOrCallback: EventType[] | ((message: EventMessage) => void),
    callback?: (message: EventMessage) => void
  ): () => void {
    let eventTypes: Set<EventType>;
    let messageCallback: (message: EventMessage) => void;

    if (typeof eventTypesOrCallback === 'function') {
      messageCallback = eventTypesOrCallback;
      eventTypes = new Set(['message', 'update', 'connect', 'disconnect', 'node_created', 'node_deleted', 'content_updated', 'context_updated', 'capability_updated']);
    } else {
      eventTypes = new Set(eventTypesOrCallback);
      messageCallback = callback!;
    }

    const subscription: Subscription = {
      nodeId,
      eventTypes,
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

  emit(eventType: EventType, message: Omit<SharedMessage, 'eventType'> & { metadata?: any }) {
    console.log('MessageBus: Emitting event:', eventType, 'Message:', message);
    
    const eventMessage: EventMessage = {
      ...message,
      eventType,
      timestamp: new Date(),
      metadata: {
        ...message.metadata,
        emittedAt: Date.now()
      }
    };

    // Find all relevant subscriptions
    const relevantSubscriptions = this.subscriptions.filter(sub => {
      // Check if this subscription should receive this message
      const isRelevantType = sub.eventTypes.has(eventType);
      const isRelevantNode = !sub.nodeId || 
                            message.receiverId === sub.nodeId || 
                            message.senderId === sub.nodeId;
      
      console.log('MessageBus: Checking subscription:', {
        subId: sub.nodeId,
        eventTypes: Array.from(sub.eventTypes),
        isRelevantType,
        isRelevantNode
      });
      
      return isRelevantType && isRelevantNode;
    });

    console.log('MessageBus: Found relevant subscriptions:', relevantSubscriptions.length);

    // Notify all relevant subscribers
    relevantSubscriptions.forEach(sub => {
      try {
        console.log('MessageBus: Delivering message to node:', sub.nodeId);
        sub.callback(eventMessage);
      } catch (error) {
        console.error(`Error delivering message to node ${sub.nodeId}:`, error);
      }
    });

    // Emit context update for connected nodes if relevant
    if (['content_updated', 'connect', 'disconnect'].includes(eventType)) {
      console.log('MessageBus: Emitting context updates');
      this.emitContextUpdates(eventMessage);
    }

    return eventMessage;
  }

  private handleNodeCreated(message: EventMessage) {
    const { nodeId, nodeType } = message.metadata || {};
    if (nodeId) {
      this.nodeContents.set(nodeId, { type: nodeType });
      this.nodeConnections.set(nodeId, new Set());
    }
  }

  private handleNodeDeleted(message: EventMessage) {
    const { nodeId } = message.metadata || {};
    if (nodeId) {
      this.nodeContents.delete(nodeId);
      this.nodeConnections.delete(nodeId);
      
      // Remove node from all connections
      this.nodeConnections.forEach((connections) => {
        connections.delete(nodeId);
      });
    }
  }

  private handleNodeConnection(message: EventMessage) {
    const { source, target } = message.metadata || {};
    if (source && target) {
      if (!this.nodeConnections.has(source)) {
        this.nodeConnections.set(source, new Set());
      }
      if (!this.nodeConnections.has(target)) {
        this.nodeConnections.set(target, new Set());
      }
      
      this.nodeConnections.get(source)?.add(target);
      this.nodeConnections.get(target)?.add(source);
    }
  }

  private handleNodeDisconnection(message: EventMessage) {
    const { source, target } = message.metadata || {};
    if (source && target) {
      this.nodeConnections.get(source)?.delete(target);
      this.nodeConnections.get(target)?.delete(source);
    }
  }

  private handleContentUpdate(message: EventMessage) {
    const { nodeId, content } = message.metadata || {};
    if (nodeId) {
      const currentContent = this.nodeContents.get(nodeId) || {};
      this.nodeContents.set(nodeId, { ...currentContent, content });
    }
  }

  private emitContextUpdates(triggerMessage: EventMessage) {
    const affectedNodes = new Set<string>();
    
    // Get all nodes that need context updates
    if (triggerMessage.senderId) {
      affectedNodes.add(triggerMessage.senderId);
      this.nodeConnections.get(triggerMessage.senderId)?.forEach(nodeId => {
        affectedNodes.add(nodeId);
      });
    }
    if (triggerMessage.receiverId) {
      affectedNodes.add(triggerMessage.receiverId);
      this.nodeConnections.get(triggerMessage.receiverId)?.forEach(nodeId => {
        affectedNodes.add(nodeId);
      });
    }

    // Debounce context updates for each affected node
    affectedNodes.forEach(nodeId => {
      // Clear any existing timeout for this node
      if (this.contextUpdateTimeouts.has(nodeId)) {
        clearTimeout(this.contextUpdateTimeouts.get(nodeId));
      }

      // Check if we've updated recently (within 500ms)
      const lastUpdate = this.lastContextUpdate.get(nodeId) || 0;
      const now = Date.now();
      if (now - lastUpdate < 500) {
        return;
      }

      // Set a new timeout for this node
      const timeout = setTimeout(() => {
        const connectedNodes = this.nodeConnections.get(nodeId) || new Set();
        const contextUpdate: EventMessage = {
          id: `ctx-${Date.now()}-${nodeId}`,
          eventType: 'context_updated',
          senderId: 'system',
          receiverId: nodeId,
          type: 'context',
          content: 'Environment context updated',
          timestamp: new Date(),
          status: 'sent',
          metadata: {
            nodeId,
            connectedNodes: Array.from(connectedNodes),
            connectedNodesContent: Array.from(connectedNodes).map(connectedId => ({
              nodeId: connectedId,
              ...this.nodeContents.get(connectedId)
            }))
          }
        };

        // Update last update timestamp
        this.lastContextUpdate.set(nodeId, Date.now());
        
        // Find subscribers for this node and notify them
        this.subscriptions
          .filter(sub => sub.nodeId === nodeId && sub.eventTypes.has('context_updated'))
          .forEach(sub => {
            try {
              sub.callback(contextUpdate);
            } catch (error) {
              console.error(`Error delivering context update to node ${nodeId}:`, error);
            }
          });

        // Clear the timeout reference
        this.contextUpdateTimeouts.delete(nodeId);
      }, 100); // Delay context updates by 100ms

      this.contextUpdateTimeouts.set(nodeId, timeout);
    });
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

  // Helper method to get node connections
  getNodeConnections(nodeId: string): string[] {
    return Array.from(this.nodeConnections.get(nodeId) || []);
  }

  // Helper method to get node content
  getNodeContent(nodeId: string): any {
    return this.nodeContents.get(nodeId);
  }
}

export const messageBus = new MessageBus(); 