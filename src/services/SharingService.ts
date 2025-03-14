import { v4 as uuidv4 } from 'uuid';
import { messageBus } from './MessageBus';
import { ShareSettings, SharePermission, ShareInvite, BoardShare } from '../types/sharing';

export class SharingService {
  private static instance: SharingService;
  private activeShares: Map<string, ShareSettings>;

  private constructor() {
    this.activeShares = new Map();
    this.setupMessageHandlers();
  }

  public static getInstance(): SharingService {
    if (!SharingService.instance) {
      SharingService.instance = new SharingService();
    }
    return SharingService.instance;
  }

  private setupMessageHandlers() {
    messageBus.subscribe('sharing-service', ['message'], (message) => {
      if (message.type === 'share-request') {
        this.handleShareRequest(message as BoardShare);
      } else if (message.type === 'share-invite') {
        this.handleShareInvite(message as ShareInvite);
      }
    });
  }

  public async shareBoard(boardId: string, settings: Partial<ShareSettings>): Promise<ShareSettings> {
    const currentSettings = this.activeShares.get(boardId) || {
      isPublic: false,
      collaborators: [],
    };

    const updatedSettings: ShareSettings = {
      ...currentSettings,
      ...settings,
      shareLink: settings.isPublic ? this.generateShareLink(boardId) : undefined,
    };

    this.activeShares.set(boardId, updatedSettings);

    await messageBus.emit('message', {
      type: 'share-update',
      boardId,
      settings: updatedSettings,
      senderId: 'sharing-service',
      receiverId: 'all',
    });

    return updatedSettings;
  }

  public async inviteCollaborator(
    boardId: string,
    email: string,
    permissions: SharePermission
  ): Promise<ShareInvite> {
    const invite: ShareInvite = {
      boardId,
      inviteeEmail: email,
      permissions,
      inviteToken: uuidv4(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      type: 'share-invite',
      senderId: 'sharing-service',
      receiverId: 'all',
    };

    await messageBus.emit('message', invite);
    return invite;
  }

  public async acceptInvite(inviteToken: string): Promise<boolean> {
    // Implementation for accepting invites would go here
    // This would validate the token and add the user to collaborators
    return true;
  }

  public getShareSettings(boardId: string): ShareSettings | undefined {
    return this.activeShares.get(boardId);
  }

  public async updateCollaboratorPermissions(
    boardId: string,
    userId: string,
    permissions: SharePermission
  ): Promise<boolean> {
    const settings = this.activeShares.get(boardId);
    if (!settings) return false;

    const collaborator = settings.collaborators.find(c => c.userId === userId);
    if (!collaborator) return false;

    collaborator.permissions = permissions;
    await this.shareBoard(boardId, settings);
    return true;
  }

  private generateShareLink(boardId: string): string {
    const token = uuidv4();
    return `${window.location.origin}/shared/${boardId}?token=${token}`;
  }

  private async handleShareRequest(message: BoardShare) {
    // Handle incoming share requests
    await this.shareBoard(message.boardId, message.settings);
  }

  private async handleShareInvite(invite: ShareInvite) {
    // Handle incoming share invites
    // This would typically store the invite and notify the user
    console.log('Received share invite:', invite);
  }
} 