import { Node } from 'reactflow';
import { SharedMessage as MessageBusSharedMessage } from '../services/MessageBus';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  from?: string;
  to?: string;
  status?: 'sent' | 'delivered' | 'failed';
}

export interface SharedMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'failed';
  role: 'user' | 'assistant';
}

export interface AINodeData {
  type: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  systemPrompt?: string;
  messages: Message[];
  connectedNodes: Set<string>;
  role?: string;
  name?: string;
}

export type AINode = Node<AINodeData>; 