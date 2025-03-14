import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { useSandboxState } from '../services/SandboxState';

interface NodeConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  sourceNodeId: string;
}

export function NodeConnectionDialog({ open, onClose, sourceNodeId }: NodeConnectionDialogProps) {
  const { getActiveAgents, updateAgent } = useSandboxState();
  const [availableParents, setAvailableParents] = useState<Array<{
    id: string;
    name: string;
    isParent: boolean;
  }>>([]);

  useEffect(() => {
    if (open) {
      // Get all active agents that are parent nodes
      const agents = getActiveAgents();
      const parents = agents
        .filter(agent => agent.isParent === true && agent.id !== sourceNodeId)
        .map(agent => ({
          id: agent.id,
          name: agent.name,
          isParent: true // We know this is true because of the filter
        }));
      setAvailableParents(parents);
    }
  }, [open, getActiveAgents, sourceNodeId]);

  const handleConnect = (parentId: string) => {
    // Create a connection event
    const event = new CustomEvent('node-connect', {
      detail: {
        source: sourceNodeId,
        target: parentId
      }
    });
    window.dispatchEvent(event);

    // Update the source node with the selected parent
    updateAgent(sourceNodeId, {
      parentNodeId: parentId,
      lastSeen: new Date()
    });
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Connect to Parent Node</Typography>
          <Chip
            label="Select a parent node to connect to"
            size="small"
            color="info"
            variant="outlined"
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <List>
          {availableParents.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No parent nodes available"
                secondary="Create a parent node first by setting a node as parent in its Settings tab"
              />
            </ListItem>
          ) : (
            availableParents.map((parent) => (
              <ListItem
                key={parent.id}
                secondaryAction={
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleConnect(parent.id)}
                  >
                    Connect
                  </Button>
                }
              >
                <ListItemIcon>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </ListItemIcon>
                <ListItemText
                  primary={parent.name}
                  secondary={`Node ID: ${parent.id}`}
                />
              </ListItem>
            ))
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
} 