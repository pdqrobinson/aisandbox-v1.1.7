import { create } from 'zustand';
import { Node, Edge, Connection, XYPosition } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { NodeData, NodeType } from '../types/nodes';
import { messageBus } from '../services/MessageBus';

interface CanvasState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  addNode: (type: NodeType, position: XYPosition, data?: Partial<NodeData>) => string;
  updateNode: (nodeId: string, data: Partial<NodeData>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (connection: Connection) => void;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edge: Edge) => void;
  getNode: (nodeId: string) => Node<NodeData> | undefined;
  clear: () => void;
  onConnect: (connection: Connection) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  addNode: (type: NodeType, position: XYPosition, data?: Partial<NodeData>) => {
    const nodeId = uuidv4();
    const newNode: Node<NodeData> = {
      id: nodeId,
      type,
      position,
      data: {
        label: `${type} ${nodeId.slice(0, 4)}`,
        ...data
      }
    };

    set(state => ({
      nodes: [...state.nodes, newNode]
    }));

    // Emit node creation event
    messageBus.emit('node_created', {
      senderId: 'system',
      content: `Node ${nodeId} created`,
      type: 'system',
      metadata: {
        nodeId,
        nodeType: type,
        position,
        data: newNode.data
      }
    });

    return nodeId;
  },

  updateNode: (nodeId: string, data: Partial<NodeData>) => {
    set(state => ({
      nodes: state.nodes.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    }));

    // Emit content update event
    messageBus.emit('content_updated', {
      senderId: nodeId,
      content: 'Node content updated',
      type: 'update',
      metadata: {
        nodeId,
        content: data,
        timestamp: Date.now()
      }
    });
  },

  removeNode: (nodeId: string) => {
    // Get connected edges before removing
    const connectedEdges = get().edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );

    // Remove connected edges first
    connectedEdges.forEach(edge => {
      messageBus.emit('disconnect', {
        senderId: 'system',
        content: 'Edge removed',
        type: 'system',
        metadata: {
          source: edge.source,
          target: edge.target
        }
      });
    });

    set(state => ({
      nodes: state.nodes.filter(node => node.id !== nodeId),
      edges: state.edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      )
    }));

    // Emit node deletion event
    messageBus.emit('node_deleted', {
      senderId: 'system',
      content: `Node ${nodeId} deleted`,
      type: 'system',
      metadata: {
        nodeId,
        connectedEdges
      }
    });
  },

  addEdge: (connection: Connection) => {
    const newEdge: Edge = {
      id: `${connection.source}-${connection.target}`,
      ...connection
    };

    set(state => ({
      edges: [...state.edges, newEdge]
    }));

    // Emit connection event
    messageBus.emit('connect', {
      senderId: connection.source,
      receiverId: connection.target,
      content: 'Nodes connected',
      type: 'connection',
      metadata: {
        source: connection.source,
        target: connection.target,
        edgeId: newEdge.id
      }
    });
  },

  removeEdge: (edgeId: string) => {
    const edge = get().edges.find(e => e.id === edgeId);
    if (edge) {
      set(state => ({
        edges: state.edges.filter(e => e.id !== edgeId)
      }));

      // Emit disconnection event
      messageBus.emit('disconnect', {
        senderId: edge.source,
        receiverId: edge.target,
        content: 'Nodes disconnected',
        type: 'connection',
        metadata: {
          source: edge.source,
          target: edge.target,
          edgeId
        }
      });
    }
  },

  updateEdge: (edge: Edge) => {
    set(state => ({
      edges: state.edges.map(e => (e.id === edge.id ? edge : e))
    }));
  },

  getNode: (nodeId: string) => {
    return get().nodes.find(node => node.id === nodeId);
  },

  clear: () => {
    const { nodes, edges } = get();
    
    // Emit disconnect events for all edges
    edges.forEach(edge => {
      messageBus.emit('disconnect', {
        senderId: edge.source,
        receiverId: edge.target,
        content: 'Nodes disconnected',
        type: 'connection',
        metadata: {
          source: edge.source,
          target: edge.target,
          edgeId: edge.id
        }
      });
    });

    // Emit delete events for all nodes
    nodes.forEach(node => {
      messageBus.emit('node_deleted', {
        senderId: 'system',
        content: `Node ${node.id} deleted`,
        type: 'system',
        metadata: {
          nodeId: node.id
        }
      });
    });

    set({ nodes: [], edges: [] });
  },

  onConnect: (connection: Connection) => {
    console.log('canvasStore: Connection established:', connection);
    
    // Make sure to emit a connect event on the messageBus
    if (typeof messageBus !== 'undefined') {
      messageBus.emit('connect', {
        source: connection.source,
        target: connection.target,
        sourceType: connection.sourceType,
        targetType: connection.targetType
      });
    }

    if (!connection.source || !connection.target) return;

    const sourceNode = get().nodes.find(node => node.id === connection.source);
    const targetNode = get().nodes.find(node => node.id === connection.target);

    if (!sourceNode || !targetNode) return;

    // Emit connection events for both nodes
    messageBus.emit('connect', {
      senderId: connection.source,
      receiverId: connection.target,
      content: 'Nodes connected',
      type: 'connection',
      metadata: {
        type: sourceNode.type,
        source: connection.source,
        target: connection.target,
        sourceType: sourceNode.type,
        targetType: targetNode.type
      }
    });

    messageBus.emit('connect', {
      senderId: connection.target,
      receiverId: connection.source,
      content: 'Nodes connected',
      type: 'connection',
      metadata: {
        type: targetNode.type,
        source: connection.target,
        target: connection.source,
        sourceType: targetNode.type,
        targetType: sourceNode.type
      }
    });

    // Update the edge in the store
    const newEdge: Edge = {
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      type: 'default',
      animated: false,
      style: { stroke: '#555' }
    };

    set(state => ({
      edges: [...state.edges, newEdge]
    }));
  }
})); 