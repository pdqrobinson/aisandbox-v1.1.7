import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { SandboxState, SandboxConfig, Agent, Message, Rule, DataInputNode } from '../types/sandbox';

type SandboxAction =
  | { type: 'ADD_AGENT'; payload: Agent }
  | { type: 'UPDATE_AGENT'; payload: Agent }
  | { type: 'REMOVE_AGENT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'ADD_RULE'; payload: Rule }
  | { type: 'UPDATE_SANDBOX_CONFIG'; payload: Partial<SandboxState> }
  | { type: 'RESET_SANDBOX' }
  | { type: 'ADD_DATA_INPUT'; payload: DataInputNode }
  | { type: 'UPDATE_DATA_INPUT'; payload: DataInputNode }
  | { type: 'REMOVE_DATA_INPUT'; payload: string };

interface SandboxContextType {
  state: SandboxState;
  config: SandboxConfig;
  dispatch: React.Dispatch<SandboxAction>;
}

const defaultConfig: SandboxConfig = {
  maxAgents: 10,
  maxObjects: 50,
  maxMessages: 1000,
  timeScale: 1,
  physicsEnabled: true,
  communicationRules: [],
  aiBehaviorRules: [],
};

const initialState: SandboxState = {
  id: 'sandbox-1',
  name: 'AI Sandbox',
  description: 'A sandbox environment for AI agents',
  createdAt: new Date(),
  updatedAt: new Date(),
  agents: [],
  dataInputs: [],
  objects: [],
  rules: [],
  messages: []
};

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

function sandboxReducer(state: SandboxState, action: SandboxAction): SandboxState {
  switch (action.type) {
    case 'ADD_AGENT':
      return {
        ...state,
        agents: [...state.agents, action.payload],
        updatedAt: new Date()
      };
    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: state.agents.map(agent =>
          agent.id === action.payload.id ? action.payload : agent
        ),
        updatedAt: new Date()
      };
    case 'REMOVE_AGENT':
      return {
        ...state,
        agents: state.agents.filter(agent => agent.id !== action.payload),
        updatedAt: new Date()
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        updatedAt: new Date()
      };
    case 'ADD_RULE':
      return {
        ...state,
        rules: [...state.rules, action.payload],
        updatedAt: new Date()
      };
    case 'UPDATE_SANDBOX_CONFIG':
      return {
        ...state,
        ...action.payload,
        updatedAt: new Date()
      };
    case 'RESET_SANDBOX':
      return {
        ...initialState,
        id: state.id,
        createdAt: state.createdAt,
        updatedAt: new Date()
      };
    case 'ADD_DATA_INPUT':
      return {
        ...state,
        dataInputs: [...state.dataInputs, action.payload],
        updatedAt: new Date()
      };
    case 'UPDATE_DATA_INPUT':
      return {
        ...state,
        dataInputs: state.dataInputs.map(node =>
          node.id === action.payload.id ? action.payload : node
        ),
        updatedAt: new Date()
      };
    case 'REMOVE_DATA_INPUT':
      return {
        ...state,
        dataInputs: state.dataInputs.filter(node => node.id !== action.payload),
        updatedAt: new Date()
      };
    default:
      return state;
  }
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sandboxReducer, initialState);
  const [config, setConfig] = React.useState<SandboxConfig>(defaultConfig);

  const value = {
    state,
    config,
    dispatch,
  };

  return (
    <SandboxContext.Provider value={value}>
      {children}
    </SandboxContext.Provider>
  );
}

export function useSandbox() {
  const context = useContext(SandboxContext);
  if (context === undefined) {
    throw new Error('useSandbox must be used within a SandboxProvider');
  }
  return context;
} 