import { Node, Edge } from 'reactflow';
import { SharedMessage } from './sandbox';

export interface BaseNodeData {
  label: string;
  metadata?: NodeMetadata;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ImageGenerationSettings {
  provider: 'fal.ai';
  model: string;
  height: number;
  width: number;
  guidance_scale: number;
  num_inference_steps: number;
  negative_prompt?: string;
  apiKey: string;
}

export interface ImageGenerationNodeData extends BaseNodeData {
  settings?: ImageGenerationSettings;
  images?: Array<{
    id: string;
    prompt: string;
    imageUrl: string;
    timestamp: number;
    settings?: {
      guidance_scale: number;
      num_inference_steps: number;
      negative_prompt?: string;
    };
  }>;
}

export interface ChatSettings {
  provider: 'cohere';
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
  systemPrompt?: string;
  environmentPrompt?: string;
}

export interface ChatNodeData extends BaseNodeData {
  settings?: ChatSettings;
  messages?: Message[];
}

export interface NotesNodeData extends BaseNodeData {
  content?: string;
}

export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  caption?: string;
  thumbnail?: string;
}

export interface DocumentNodeData extends BaseNodeData {
  documentUrl?: string;
  title?: string;
}

export interface UrlNodeData extends BaseNodeData {
  url?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  content?: string;
  lastFetched?: string;
}

export type NodeData = BaseNodeData & (
  | ChatNodeData
  | NotesNodeData
  | ImageNodeData
  | DocumentNodeData
  | UrlNodeData
  | ImageGenerationNodeData
);

export type CustomNode = Node<NodeData>;
export type CustomEdge = Edge;

export interface NodeConnection {
  source: string;
  target: string;
  label?: string;
  metadata?: Record<string, any>;
}

export interface NodeEvent {
  type: 'update' | 'request' | 'response' | 'action';
  source: string;
  target: string;
  payload: any;
  timestamp: number;
}

export interface NodeCapability {
  type: string;
  actions: string[];
  description: string;
}

export interface NodeMetadata {
  type: string;
  capabilities: NodeCapability[];
  acceptedConnections: string[];
  description: string;
} 