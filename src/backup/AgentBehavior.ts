import { AIAgent } from '../services/SandboxState';
import { AIRoleManager } from '../services/AIRoles';
import { InteractionManager } from '../services/InteractionRules';

export interface AgentAction {
  type: 'move' | 'interact' | 'collect' | 'modify';
  targetId: string;
  data?: any;
  timestamp: Date;
}

export interface AgentState {
  currentNodeId: string;
  collectedData: any[];
  history: AgentAction[];
  performance: {
    successfulActions: number;
    failedActions: number;
    totalReward: number;
  };
}

export class AgentBehaviorManager {
  private static instance: AgentBehaviorManager;
  private agentStates: Map<string, AgentState> = new Map();
  private roleManager: AIRoleManager;
  private interactionManager: InteractionManager;

  private constructor() {
    this.roleManager = AIRoleManager.getInstance();
    this.interactionManager = InteractionManager.getInstance();
  }

  public static getInstance(): AgentBehaviorManager {
    if (!AgentBehaviorManager.instance) {
      AgentBehaviorManager.instance = new AgentBehaviorManager();
    }
    return AgentBehaviorManager.instance;
  }

  public initializeAgent(agentId: string, startNodeId: string): void {
    this.agentStates.set(agentId, {
      currentNodeId: startNodeId,
      collectedData: [],
      history: [],
      performance: {
        successfulActions: 0,
        failedActions: 0,
        totalReward: 0
      }
    });
  }

  public async executeAction(agentId: string, action: AgentAction): Promise<boolean> {
    const state = this.agentStates.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not initialized`);
    }

    try {
      switch (action.type) {
        case 'move':
          await this.handleMove(agentId, action.targetId);
          break;
        case 'interact':
          await this.handleInteract(agentId, action.targetId, action.data);
          break;
        case 'collect':
          await this.handleCollect(agentId, action.targetId);
          break;
        case 'modify':
          await this.handleModify(agentId, action.targetId, action.data);
          break;
      }

      // Record successful action
      state.history.push(action);
      state.performance.successfulActions++;
      return true;
    } catch (error) {
      // Record failed action
      state.performance.failedActions++;
      return false;
    }
  }

  private async handleMove(agentId: string, targetNodeId: string): Promise<void> {
    const state = this.agentStates.get(agentId);
    if (!state) return;

    // Check if move is allowed based on roles and interactions
    const canMove = this.roleManager.canInteract(agentId, targetNodeId, 'move');
    if (!canMove) {
      throw new Error('Move not allowed');
    }

    state.currentNodeId = targetNodeId;
  }

  private async handleInteract(agentId: string, targetNodeId: string, data: any): Promise<void> {
    // Check if interaction is allowed
    const canInteract = this.roleManager.canInteract(agentId, targetNodeId, 'interact');
    if (!canInteract) {
      throw new Error('Interaction not allowed');
    }

    // Record the interaction
    this.interactionManager.recordInteraction({
      sourceAgent: { id: agentId } as AIAgent,
      targetAgent: { id: targetNodeId } as AIAgent,
      capability: {
        id: 'interact',
        name: 'Interact',
        description: 'Basic interaction capability',
        requiresPermission: true
      },
      timestamp: new Date()
    });
  }

  private async handleCollect(agentId: string, targetNodeId: string): Promise<void> {
    const state = this.agentStates.get(agentId);
    if (!state) return;

    // Check if collection is allowed
    const canCollect = this.roleManager.canInteract(agentId, targetNodeId, 'collect');
    if (!canCollect) {
      throw new Error('Collection not allowed');
    }

    // Add collected data to agent's state
    state.collectedData.push({
      source: targetNodeId,
      timestamp: new Date()
    });
  }

  private async handleModify(agentId: string, targetNodeId: string, data: any): Promise<void> {
    // Check if modification is allowed
    const canModify = this.roleManager.canInteract(agentId, targetNodeId, 'modify');
    if (!canModify) {
      throw new Error('Modification not allowed');
    }

    // Record the modification
    this.interactionManager.recordInteraction({
      sourceAgent: { id: agentId } as AIAgent,
      targetAgent: { id: targetNodeId } as AIAgent,
      capability: {
        id: 'modify',
        name: 'Modify',
        description: 'Data modification capability',
        requiresPermission: true
      },
      timestamp: new Date()
    });
  }

  public getAgentState(agentId: string): AgentState | undefined {
    return this.agentStates.get(agentId);
  }

  public updatePerformance(agentId: string, reward: number): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.performance.totalReward += reward;
    }
  }

  public getAgentHistory(agentId: string): AgentAction[] {
    return this.agentStates.get(agentId)?.history || [];
  }

  public getAgentPerformance(agentId: string): AgentState['performance'] | undefined {
    return this.agentStates.get(agentId)?.performance;
  }
} 