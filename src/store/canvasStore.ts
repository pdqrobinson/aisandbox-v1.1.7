import { create } from 'zustand';
import { Node, Edge, Connection, XYPosition } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { NodeData, NodeType } from '../types/nodes';
import { eventBus } from '../services/EventBus';

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
        id: nodeId,
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        ...data,
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));

    eventBus.emit({
      type: 'update',
      source: nodeId,
      payload: { action: 'add', node: newNode },
    });

    return nodeId;
  },

  updateNode: (nodeId: string, data: Partial<NodeData>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    }));

    eventBus.emit({
      type: 'update',
      source: nodeId,
      payload: { action: 'update', data },
    });
  },

  removeNode: (nodeId: string) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    }));

    eventBus.emit({
      type: 'update',
      source: nodeId,
      payload: { action: 'remove' },
    });
  },

  addEdge: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: uuidv4(),
    };

    set((state) => ({
      edges: [...state.edges, newEdge],
    }));

    eventBus.emit({
      type: 'connect',
      source: connection.source!,
      target: connection.target!,
      payload: { edge: newEdge },
    });
  },

  removeEdge: (edgeId: string) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return;

    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));

    eventBus.emit({
      type: 'disconnect',
      source: edge.source,
      target: edge.target,
      payload: { edgeId },
    });
  },

  updateEdge: (edge: Edge) => {
    set((state) => ({
      edges: state.edges.map((e) => (e.id === edge.id ? edge : e)),
    }));
  },

  getNode: (nodeId: string) => {
    return get().nodes.find((node) => node.id === nodeId);
  },

  clear: () => {
    set({ nodes: [], edges: [] });
  },
})); 