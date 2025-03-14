import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Tooltip,
  Box,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ShareSettings, SharePermission, CollaboratorAccess } from '../types/sharing';
import { SharingService } from '../services/SharingService';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, boardId }) => {
  const [settings, setSettings] = useState<ShareSettings>({
    isPublic: false,
    collaborators: [],
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const sharingService = SharingService.getInstance();

  useEffect(() => {
    if (open) {
      const currentSettings = sharingService.getShareSettings(boardId);
      if (currentSettings) {
        setSettings(currentSettings);
      }
    }
  }, [open, boardId]);

  const handlePublicToggle = async () => {
    const updatedSettings = await sharingService.shareBoard(boardId, {
      ...settings,
      isPublic: !settings.isPublic,
    });
    setSettings(updatedSettings);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    const permissions: SharePermission = {
      read: true,
      write: true,
      admin: false,
    };

    await sharingService.inviteCollaborator(boardId, inviteEmail, permissions);
    setInviteEmail('');
  };

  const handleCopyLink = () => {
    if (settings.shareLink) {
      navigator.clipboard.writeText(settings.shareLink);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    const updatedCollaborators = settings.collaborators.filter(
      (c) => c.userId !== userId
    );
    const updatedSettings = await sharingService.shareBoard(boardId, {
      ...settings,
      collaborators: updatedCollaborators,
    });
    setSettings(updatedSettings);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Share Board</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.isPublic}
                onChange={handlePublicToggle}
                color="primary"
              />
            }
            label="Public Access"
          />
          {settings.isPublic && settings.shareLink && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={settings.shareLink}
                InputProps={{ readOnly: true }}
              />
              <Tooltip title="Copy link">
                <IconButton onClick={handleCopyLink} size="small">
                  <CopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Invite Collaborators
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Enter email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={handleInvite}
            disabled={!inviteEmail}
          >
            Invite
          </Button>
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Collaborators
        </Typography>
        <List>
          {settings.collaborators.map((collaborator) => (
            <ListItem key={collaborator.userId}>
              <ListItemText
                primary={collaborator.email}
                secondary={Object.entries(collaborator.permissions)
                  .filter(([, value]) => value)
                  .map(([key]) => key)
                  .join(', ')}
              />
              <ListItemSecondaryAction>
                <Tooltip title="Edit permissions">
                  <IconButton edge="end" sx={{ mr: 1 }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveCollaborator(collaborator.userId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}; 