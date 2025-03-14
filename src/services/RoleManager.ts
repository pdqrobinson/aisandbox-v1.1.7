import { AIRole } from '../types/sandbox';

class RoleManager {
  private roles: Map<string, AIRole> = new Map();

  addRole(nodeId: string, role: AIRole) {
    this.roles.set(nodeId, {
      id: role.id,
      name: role.name,
      description: role.description,
      responsibilities: role.responsibilities,
      constraints: role.constraints || [],  // Provide default empty array
      systemPrompt: role.systemPrompt
    });
  }

  getRole(nodeId: string): AIRole | undefined {
    return this.roles.get(nodeId);
  }

  removeRole(nodeId: string) {
    this.roles.delete(nodeId);
  }

  clear() {
    this.roles.clear();
  }
}

export const roleManager = new RoleManager(); 