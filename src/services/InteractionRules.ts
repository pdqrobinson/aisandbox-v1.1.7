import { AIAgent } from './SandboxState';

export interface InteractionCapability {
  id: string;
  name: string;
  description: string;
  requiresPermission: boolean;
}

export interface InteractionRule {
  id: string;
  name: string;
  description: string;
  allowedCapabilities: string[];
  restrictions: string[];
}

export interface InteractionContext {
  sourceAgent: AIAgent;
  targetAgent: AIAgent;
  capability: InteractionCapability;
  timestamp: Date;
}

export const INTERACTION_CAPABILITIES: InteractionCapability[] = [
  {
    id: 'message',
    name: 'Send Message',
    description: 'Send a text message to another AI agent',
    requiresPermission: false
  },
  {
    id: 'share_context',
    name: 'Share Context',
    description: 'Share information about the current context or state',
    requiresPermission: false
  },
  {
    id: 'modify_settings',
    name: 'Modify Settings',
    description: 'Modify another agent\'s settings (temperature, system prompt)',
    requiresPermission: true
  },
  {
    id: 'create_node',
    name: 'Create Node',
    description: 'Create a new AI node in the sandbox',
    requiresPermission: true
  },
  {
    id: 'delete_node',
    name: 'Delete Node',
    description: 'Delete an existing AI node',
    requiresPermission: true
  }
];

export const INTERACTION_RULES: InteractionRule[] = [
  {
    id: 'basic_communication',
    name: 'Basic Communication',
    description: 'Allow basic message exchange between agents',
    allowedCapabilities: ['message', 'share_context'],
    restrictions: []
  },
  {
    id: 'advanced_control',
    name: 'Advanced Control',
    description: 'Allow modification of other agents and sandbox creation',
    allowedCapabilities: ['modify_settings', 'create_node', 'delete_node'],
    restrictions: ['requires_explicit_permission']
  }
];

export class InteractionManager {
  private static instance: InteractionManager;
  private activeRules: Map<string, InteractionRule> = new Map();
  private activeCapabilities: Map<string, InteractionCapability> = new Map();
  private interactionHistory: InteractionContext[] = [];

  private constructor() {
    // Initialize with default rules and capabilities
    INTERACTION_RULES.forEach(rule => this.activeRules.set(rule.id, rule));
    INTERACTION_CAPABILITIES.forEach(cap => this.activeCapabilities.set(cap.id, cap));
  }

  static getInstance(): InteractionManager {
    if (!InteractionManager.instance) {
      InteractionManager.instance = new InteractionManager();
    }
    return InteractionManager.instance;
  }

  canInteract(sourceAgent: AIAgent, targetAgent: AIAgent, capabilityId: string): boolean {
    const capability = this.activeCapabilities.get(capabilityId);
    if (!capability) return false;

    // Check if capability requires permission
    if (capability.requiresPermission) {
      // TODO: Implement permission checking logic
      return false;
    }

    // Check if agents are connected
    if (!sourceAgent.connectedNodes?.has(targetAgent.id)) {
      return false;
    }

    // Check if capability is allowed by any active rule
    return Array.from(this.activeRules.values()).some((rule: InteractionRule) => 
      rule.allowedCapabilities.includes(capabilityId)
    );
  }

  recordInteraction(context: InteractionContext): void {
    this.interactionHistory.push(context);
  }

  getInteractionHistory(): InteractionContext[] {
    return [...this.interactionHistory];
  }

  getAgentCapabilities(agent: AIAgent): InteractionCapability[] {
    return Array.from(this.activeCapabilities.values()).filter(cap => 
      this.canInteract(agent, agent, cap.id)
    );
  }

  getAgentRules(agent: AIAgent): InteractionRule[] {
    return Array.from(this.activeRules.values());
  }

  addRule(rule: InteractionRule): void {
    this.activeRules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.activeRules.delete(ruleId);
  }

  addCapability(capability: InteractionCapability): void {
    this.activeCapabilities.set(capability.id, capability);
  }

  removeCapability(capabilityId: string): void {
    this.activeCapabilities.delete(capabilityId);
  }
} 