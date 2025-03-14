import { EventMessage } from '../services/MessageBus';

export interface SharePermission {
  read: boolean;
  write: boolean;
  admin: boolean;
}

export interface ShareSettings {
  isPublic: boolean;
  collaborators: CollaboratorAccess[];
  shareLink?: string;
  expiryDate?: Date;
}

export interface CollaboratorAccess {
  userId: string;
  email: string;
  permissions: SharePermission;
  addedAt: Date;
}

export interface BoardShare extends EventMessage {
  boardId: string;
  settings: ShareSettings;
}

export interface ShareInvite extends EventMessage {
  boardId: string;
  inviteeEmail: string;
  permissions: SharePermission;
  inviteToken: string;
  expiryDate: Date;
} 