import { messageBus, EventMessage, MessageRole, EventType } from './MessageBus';
import { Capability, SharedMessage, MessageType } from '../types/sandbox';

export interface NodeCapabilities {
  nodeId: string;
  capabilities: Capability[];
  metadata?: Record<string, any>;
}

export class NodeCapabilityService {
  private static instance: NodeCapabilityService;
  private nodeCapabilities: Map<string, Set<Capability>>;

  private constructor() {
    this.nodeCapabilities = new Map();
    // Subscribe to capability events
    messageBus.subscribe('capability-service', this.handleCapabilityEvent);

    // Cleanup on window unload
    window.addEventListener('unload', () => {
      messageBus.unsubscribe('capability-service', this.handleCapabilityEvent);
    });
  }

  public static getInstance(): NodeCapabilityService {
    if (!NodeCapabilityService.instance) {
      NodeCapabilityService.instance = new NodeCapabilityService();
    }
    return NodeCapabilityService.instance;
  }

  private handleCapabilityEvent = (message: EventMessage) => {
    const { senderId, content, metadata } = message;
    if (metadata?.action === 'register') {
      this.registerCapabilities(senderId, metadata.capabilities);
    } else if (metadata?.action === 'unregister') {
      this.unregisterNode(senderId);
    }
  };

  public addCapability(nodeId: string, capability: Capability) {
    if (!this.nodeCapabilities.has(nodeId)) {
      this.nodeCapabilities.set(nodeId, new Set());
    }
    this.nodeCapabilities.get(nodeId)?.add(capability);

    // Broadcast capability addition
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: `Added capability: ${capability}`,
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: { action: 'add', capability }
    };
    messageBus.emit('capability' as EventType, message);
  }

  public removeCapability(nodeId: string, capability: Capability) {
    this.nodeCapabilities.get(nodeId)?.delete(capability);

    // Broadcast capability removal
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: `Removed capability: ${capability}`,
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: { action: 'remove', capability }
    };
    messageBus.emit('capability' as EventType, message);
  }

  public hasCapability(nodeId: string, capability: Capability): boolean {
    return this.nodeCapabilities.get(nodeId)?.has(capability) || false;
  }

  public getCapabilities(nodeId: string): Capability[] {
    return Array.from(this.nodeCapabilities.get(nodeId) || []);
  }

  public setCapabilities(nodeId: string, capabilities: Capability[]) {
    this.nodeCapabilities.set(nodeId, new Set(capabilities));

    // Broadcast capabilities update
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: `Updated capabilities: ${capabilities.join(', ')}`,
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: { action: 'set', capabilities }
    };
    messageBus.emit('capability' as EventType, message);
  }

  public clearCapabilities(nodeId: string) {
    this.nodeCapabilities.delete(nodeId);

    // Broadcast capabilities cleared
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: 'Cleared all capabilities',
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: { action: 'clear' }
    };
    messageBus.emit('capability' as EventType, message);
  }

  public getNodesWithCapability(capability: Capability): string[] {
    const nodes: string[] = [];
    this.nodeCapabilities.forEach((capabilities, nodeId) => {
      if (capabilities.has(capability)) {
        nodes.push(nodeId);
      }
    });
    return nodes;
  }

  registerCapabilities(nodeId: string, capabilities: Capability[], metadata?: Record<string, any>) {
    this.nodeCapabilities.set(nodeId, new Set(capabilities));
    
    // Broadcast capability registration
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: `Node ${nodeId} registered capabilities: ${capabilities.join(', ')}`,
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: {
        action: 'register',
        capabilities,
        nodeMetadata: metadata
      }
    };
    messageBus.emit('capability' as EventType, message);
  }

  unregisterNode(nodeId: string) {
    this.nodeCapabilities.delete(nodeId);
    
    // Broadcast capability unregistration
    const message: Omit<EventMessage, 'eventType'> = {
      id: `cap-${Date.now()}`,
      senderId: nodeId,
      receiverId: 'all',
      type: 'capability' as MessageType,
      content: `Node ${nodeId} unregistered all capabilities`,
      timestamp: new Date(),
      role: 'system' as MessageRole,
      from: nodeId,
      to: 'all',
      status: 'sent',
      metadata: {
        action: 'unregister'
      }
    };
    messageBus.emit('capability' as EventType, message);
  }

  getCapabilityMetadata(nodeId: string): Record<string, any> | undefined {
    const capabilities = this.nodeCapabilities.get(nodeId);
    if (capabilities) {
      return { capabilities: Array.from(capabilities) };
    }
    return undefined;
  }

  updateCapabilityMetadata(nodeId: string, metadata: Record<string, any>) {
    const capabilities = this.nodeCapabilities.get(nodeId);
    if (capabilities) {
      this.nodeCapabilities.set(nodeId, new Set(Array.from(capabilities)));
    }
  }
}

export const nodeCapabilityService = NodeCapabilityService.getInstance(); 