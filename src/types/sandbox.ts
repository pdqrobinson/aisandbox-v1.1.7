export interface SandboxState {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  agents: Agent[];
  dataInputs: DataInputNode[];
  objects: SandboxObject[];
  rules: Rule[];
  messages: Message[];
}

export type AgentPersonality = 
  | 'mentor'      // Helpful Mentor: Knowledgeable, Supportive, Patient
  | 'inventor'    // Quirky Inventor: Creative, Curious, Fun
  | 'sassy'       // Sassy Companion: Confident, Direct, Humorous
  | 'empathic'    // Empathic Listener: Compassionate, Understanding, Calm
  | 'analyst'     // Logical Analyst: Objective, Precise, Structured
;

export interface PersonalityConfig {
  type: AgentPersonality;
  name: string;
  description: string;
  tone: string;
  style: string;
  systemPrompt: string;
  behaviorRules: string[];
}

export interface Agent {
  id: string;
  name: string;
  type: 'ai' | 'human';
  model?: string;
  provider?: string;
  status: 'active' | 'inactive' | 'error';
  lastSeen: Date;
  capabilities: string[];
  connectedNodes?: string[];
  isParent?: boolean;
  role?: string;
  parentNodeId?: string | null;
  messages?: Message[];
  apiKey?: string;
  temperature?: number;
  systemPrompt?: string;
  personality?: PersonalityConfig;
}

export interface AgentState {
  status: 'idle' | 'thinking' | 'acting' | 'communicating';
  currentTask?: string;
  memory: Memory[];
}

export interface Memory {
  id: string;
  timestamp: Date;
  type: 'observation' | 'action' | 'communication' | 'thought';
  content: string;
  metadata?: Record<string, any>;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Awareness {
  visibleObjects: string[]; // IDs of objects the agent can see
  audibleMessages: string[]; // IDs of messages the agent can hear
  currentContext: string;
  selfAwareness: {
    knowsItIsAI: boolean;
    understandsSandbox: boolean;
    capabilities: string[];
  };
}

export interface SandboxObject {
  id: string;
  type: string;
  name: string;
  description: string;
  position: Position;
  properties: Record<string, any>;
  interactions: string[];
}

export interface Rule {
  id: string;
  name: string;
  type: 'communication' | 'behavior' | 'system';
  condition: string;
  action: string;
  priority: number;
  isEnabled: boolean;
}

export type MessageType = 'text' | 'command' | 'result' | 'error' | 'context_updated' | 'capability';

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SharedMessage extends Message {
  from: string;
  to: string;
  status: 'sent' | 'delivered' | 'failed';
}

export interface AIRole {
  id: string;
  name: string;
  description: string;
  responsibilities: string[];
  constraints: string[];
  systemPrompt?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  provider: 'Cohere' | 'OpenAI';
}

export interface SandboxConfig {
  maxAgents: number;
  maxObjects: number;
  maxMessages: number;
  timeScale: number;
  physicsEnabled: boolean;
  communicationRules: Rule[];
  aiBehaviorRules: Rule[];
}

export type Capability = 
  | 'process' // Can process messages and generate responses
  | 'execute' // Can execute commands or actions
  | 'route'   // Can route messages to other nodes
  | 'monitor' // Can monitor and log system events
  | 'control' // Can issue control commands
  | 'learn'   // Can learn from interactions
  | 'store'   // Can store and retrieve data
  | 'analyze' // Can analyze data and provide insights
  | 'custom'  // Custom capability (requires metadata)
;

export type EventType = 'message' | 'task' | 'status' | 'capability' | 'control' | 'context_updated';

export interface EventMessage extends Message {
  eventType: EventType;
  topic?: string;
}

export type DataInputType = 'text' | 'url' | 'document';

export interface DataInputContent {
  id: string;
  type: DataInputType;
  content: string;
  metadata: {
    title?: string;
    source?: string;
    mimeType?: string;
    timestamp: Date;
    size?: number;
  };
  processed?: {
    text: string;
    summary?: string;
    keyPoints?: string[];
  };
}

export interface DataInputNode {
  id: string;
  name: string;
  type: 'dataInput';
  contents: DataInputContent[];
  connectedAgents: string[];
  status: 'idle' | 'processing' | 'error';
  lastUpdated: Date;
} 