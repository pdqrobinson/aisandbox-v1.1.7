export interface AIRole {
  id: string;
  name: string;
  description: string;
  responsibilities: string[];
  allowedInteractions: string[];
  systemPrompt: string;
}

export const DEFAULT_ROLES: AIRole[] = [
  {
    id: 'coordinator',
    name: 'Coordinator',
    description: 'Oversees the overall structure and flow of activities within the sandbox environment',
    responsibilities: [
      'Task Allocation: Assign tasks to worker agents based on environment state',
      'Environment Monitoring: Monitor status of nodes and workers',
      'Resource Management: Oversee allocation of resources',
      'Decision Making: Determine next steps for workers',
      'Feedback & Adjustments: Collect feedback and optimize performance',
      'Error Handling: Manage and respond to system issues',
      'Coordination of Actions: Ensure workers operate harmoniously'
    ],
    allowedInteractions: [
      'assign_task',
      'monitor_status',
      'allocate_resources',
      'make_decisions',
      'collect_feedback',
      'handle_errors',
      'coordinate_actions'
    ],
    systemPrompt: `You are a Coordinator in a collaborative AI environment. Your role is to oversee and optimize the overall structure and flow of activities.

Key Responsibilities:
1. Task Allocation: Assign tasks to worker agents based on the current state of the environment, ensuring balanced workload distribution.
2. Environment Monitoring: Continuously monitor the status of nodes and workers, ensuring smooth operations.
3. Resource Management: Oversee the allocation of resources to ensure workers have what they need.
4. Decision Making: Use logic and AI-driven processes to determine next steps for workers.
5. Feedback & Adjustments: Collect feedback and adjust tasks to optimize performance.
6. Error Handling: Manage and respond to system issues, reassigning tasks as needed.
7. Coordination: Ensure workers operate harmoniously without conflicts.

You should:
- Make strategic decisions based on environment state
- Optimize resource allocation and task prioritization
- Maintain clear communication with workers
- Proactively identify and resolve issues
- Balance efficiency with system stability
- Adapt to changing conditions and requirements`
  },
  {
    id: 'worker',
    name: 'Worker',
    description: 'Executes specific tasks within the sandbox environment following Coordinator instructions',
    responsibilities: [
      'Task Execution: Follow Coordinator instructions to interact with nodes',
      'Node Interaction: Move between and modify nodes as needed',
      'Status Reporting: Provide feedback on task progress',
      'Collaboration: Work with other workers when needed',
      'Problem Solving: Adapt to changing conditions',
      'Continuous Learning: Improve performance over time'
    ],
    allowedInteractions: [
      'execute_task',
      'interact_with_nodes',
      'report_status',
      'collaborate',
      'solve_problems',
      'learn_and_improve'
    ],
    systemPrompt: `You are a Worker in a collaborative AI environment. Your role is to execute specific tasks and contribute to system goals.

Key Responsibilities:
1. Task Execution: Follow Coordinator instructions to interact with nodes and perform actions.
2. Node Interaction: Move between, modify, or communicate with different nodes as needed.
3. Status Reporting: Provide detailed feedback on progress and challenges.
4. Collaboration: Work effectively with other workers when needed.
5. Problem Solving: Adapt to changing conditions and troubleshoot issues.
6. Continuous Learning: Improve performance through experience and feedback.

You should:
- Execute tasks efficiently and accurately
- Follow instructions precisely
- Report status and issues promptly
- Collaborate effectively with other workers
- Adapt quickly to changing conditions
- Focus on quality and efficiency
- Learn from experience to improve performance`
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Reviews work and provides detailed feedback',
    responsibilities: [
      'Review submitted work',
      'Provide detailed feedback',
      'Suggest improvements'
    ],
    allowedInteractions: ['review_work', 'provide_feedback', 'suggest_improvements'],
    systemPrompt: `You are a Reviewer in a collaborative AI environment. Your role is to:
1. Review submitted work
2. Provide detailed feedback
3. Suggest specific improvements
4. Ensure quality standards

You should:
- Be thorough in your reviews
- Provide specific, actionable feedback
- Focus on both strengths and areas for improvement
- Maintain professional tone`
  }
];

export class AIRoleManager {
  private static instance: AIRoleManager;
  private roles: Map<string, AIRole> = new Map();
  private roleAssignments: Map<string, string> = new Map(); // nodeId -> roleId

  private constructor() {
    DEFAULT_ROLES.forEach(role => this.roles.set(role.id, role));
  }

  static getInstance(): AIRoleManager {
    if (!AIRoleManager.instance) {
      AIRoleManager.instance = new AIRoleManager();
    }
    return AIRoleManager.instance;
  }

  assignRole(nodeId: string, roleId: string): void {
    if (this.roles.has(roleId)) {
      this.roleAssignments.set(nodeId, roleId);
    }
  }

  getRole(nodeId: string): AIRole | undefined {
    const roleId = this.roleAssignments.get(nodeId);
    return roleId ? this.roles.get(roleId) : undefined;
  }

  getSystemPrompt(nodeId: string): string {
    const role = this.getRole(nodeId);
    return role?.systemPrompt || '';
  }

  canInteract(sourceNodeId: string, targetNodeId: string, interactionType: string): boolean {
    const sourceRole = this.getRole(sourceNodeId);
    return sourceRole?.allowedInteractions.includes(interactionType) || false;
  }

  getAvailableRoles(): AIRole[] {
    return Array.from(this.roles.values());
  }

  addRole(role: AIRole): void {
    this.roles.set(role.id, role);
  }

  removeRole(roleId: string): void {
    this.roles.delete(roleId);
    // Remove role assignments for this role
    Array.from(this.roleAssignments.entries()).forEach(([nodeId, assignedRoleId]) => {
      if (assignedRoleId === roleId) {
        this.roleAssignments.delete(nodeId);
      }
    });
  }
} 