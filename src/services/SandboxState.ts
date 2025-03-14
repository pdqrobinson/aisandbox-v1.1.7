import { create } from 'zustand';

export interface AIAgent {
  id: string;
  name: string;
  model: string;
  provider: string;
  status: 'active' | 'inactive' | 'error';
  lastSeen: Date;
  capabilities: string[];
  connectedNodes?: Set<string>;
  isParent?: boolean;
  role?: string;
  parentNodeId?: string | null;
}

interface SandboxState {
  agents: AIAgent[];
  addAgent: (agent: AIAgent) => void;
  updateAgent: (id: string, updates: Partial<AIAgent>) => void;
  removeAgent: (id: string) => void;
  getActiveAgents: () => AIAgent[];
  getAgentById: (id: string) => AIAgent | undefined;
  resetSandbox: () => void;
}

export const useSandboxState = create<SandboxState>((set, get) => ({
  agents: [],
  
  addAgent: (agent) => {
    set((state) => ({
      agents: [...state.agents, agent]
    }));
  },
  
  updateAgent: (id, updates) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, ...updates } : agent
      )
    }));
  },
  
  removeAgent: (id) => {
    set((state) => ({
      agents: state.agents.filter(agent => agent.id !== id)
    }));
  },
  
  getActiveAgents: () => {
    return get().agents.filter(agent => agent.status === 'active');
  },
  
  getAgentById: (id) => {
    return get().agents.find(agent => agent.id === id);
  },

  resetSandbox: () => {
    set({ agents: [] });
  }
})); 