import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { NodeConnectionDialogProps } from './SandboxApp';
import { useSandbox } from '../contexts/SandboxContext';

export function NodeConnectionDialog({ nodeId, open, onClose }: NodeConnectionDialogProps) {
  const { state, dispatch } = useSandbox();
  const [availableParents, setAvailableParents] = useState<Array<{
    id: string;
    name: string;
  }>>([]);

  useEffect(() => {
    if (open) {
      const parents = state.agents
        .filter(agent => agent.isParent === true && agent.id !== nodeId)
        .map(agent => ({
          id: agent.id,
          name: agent.name || agent.id
        }));
      setAvailableParents(parents);
    }
  }, [open, state.agents, nodeId]);

  const handleConnect = (parentId: string) => {
    // Create a connection event
    const event = new CustomEvent('node-connect', {
      detail: {
        source: nodeId,
        target: parentId
      }
    });
    window.dispatchEvent(event);

    // Update the source node with the selected parent
    const agent = state.agents.find(a => a.id === nodeId);
    if (agent) {
      dispatch({
        type: 'UPDATE_AGENT',
        payload: {
          ...agent,
          parentNodeId: parentId,
          lastSeen: new Date()
        }
      });
    }

    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Connect Node {nodeId}</DialogTitle>
      <DialogContent>
        {availableParents.map(parent => (
          <Button
            key={parent.id}
            onClick={() => handleConnect(parent.id)}
            variant="outlined"
            fullWidth
            sx={{ mb: 1 }}
          >
            {parent.name}
          </Button>
        ))}
        {availableParents.length === 0 && (
          <div>No available parent nodes to connect to.</div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
} 