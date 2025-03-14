import { messageBus } from './MessageBus';

export type NodeMessageType = 
  | 'note_draft'    // When a note is drafted and needs review
  | 'note_update'   // When a note is updated
  | 'note_save'     // When a note is saved
  | 'content_request' // When a node requests content
  | 'content_response'; // When a node responds with content

export interface NodeMessage {
  senderId: string;
  receiverId: string;
  type: NodeMessageType;
  content: any;
  metadata?: {
    timestamp: number;
    [key: string]: any;
  };
}

class NodeMessageService {
  private static instance: NodeMessageService;
  private subscribers: Map<string, Map<NodeMessageType, ((message: NodeMessage) => void)[]>>;

  private constructor() {
    this.subscribers = new Map();

    // Subscribe to messageBus events
    messageBus.subscribe((event) => {
      if (event.type === 'node_message') {
        this.handleNodeMessage(event.detail as NodeMessage);
      }
    });
  }

  public static getInstance(): NodeMessageService {
    if (!NodeMessageService.instance) {
      NodeMessageService.instance = new NodeMessageService();
    }
    return NodeMessageService.instance;
  }

  private handleNodeMessage(message: NodeMessage) {
    const nodeSubscribers = this.subscribers.get(message.receiverId);
    if (!nodeSubscribers) return;

    const handlers = nodeSubscribers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error handling node message:', error);
      }
    });
  }

  public subscribe(
    nodeId: string,
    messageType: NodeMessageType,
    handler: (message: NodeMessage) => void
  ): () => void {
    if (!this.subscribers.has(nodeId)) {
      this.subscribers.set(nodeId, new Map());
    }

    const nodeSubscribers = this.subscribers.get(nodeId)!;
    if (!nodeSubscribers.has(messageType)) {
      nodeSubscribers.set(messageType, []);
    }

    const handlers = nodeSubscribers.get(messageType)!;
    handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const currentHandlers = nodeSubscribers.get(messageType) || [];
      nodeSubscribers.set(
        messageType,
        currentHandlers.filter(h => h !== handler)
      );
    };
  }

  public sendMessage(message: NodeMessage) {
    messageBus.emit('node_message', {
      ...message,
      metadata: {
        ...message.metadata,
        timestamp: Date.now()
      }
    });
  }

  // Helper methods for specific message types
  public sendNoteDraft(senderId: string, receiverId: string, content: string) {
    console.log('NodeMessageService: Sending note draft:', { senderId, receiverId, content });
    this.sendMessage({
      senderId,
      receiverId,
      type: 'note_draft',
      content,
      metadata: {
        timestamp: Date.now()
      }
    });
  }

  public sendNoteUpdate(senderId: string, receiverId: string, content: string) {
    console.log('NodeMessageService: Sending note update:', { senderId, receiverId, content });
    this.sendMessage({
      senderId,
      receiverId,
      type: 'note_update',
      content,
      metadata: {
        timestamp: Date.now()
      }
    });
  }

  public sendNoteSave(senderId: string, receiverId: string, content: string) {
    console.log('NodeMessageService: Sending note save:', { senderId, receiverId, content });
    this.sendMessage({
      senderId,
      receiverId,
      type: 'note_save',
      content,
      metadata: {
        timestamp: Date.now()
      }
    });
  }

  public requestContent(senderId: string, receiverId: string) {
    this.sendMessage({
      senderId,
      receiverId,
      type: 'content_request',
      content: null,
      metadata: {
        timestamp: Date.now()
      }
    });
  }

  public sendContentResponse(senderId: string, receiverId: string, content: any) {
    this.sendMessage({
      senderId,
      receiverId,
      type: 'content_response',
      content,
      metadata: {
        timestamp: Date.now()
      }
    });
  }
}

export const nodeMessageService = NodeMessageService.getInstance(); 