import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  Paper,
  Typography,
  Button,
} from '@mui/material';
import { BaseNode } from './BaseNode';
import { NotesNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { messageBus } from '../../services/MessageBus';
import { NodeCommunicationService } from '../../services/NodeCommunicationService';
import { nodeCapabilityService } from '../../services/NodeCapabilityService';
import { nodeMessageService, NodeMessage } from '../../services/NodeMessageService';

export const NotesNode: React.FC<NodeProps<NotesNodeData>> = ({ id, data = {}, selected }) => {
  const { updateNode } = useCanvasStore();
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; content: string }>>([]);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  
  const nodeCommunicationService = useMemo(() => NodeCommunicationService.getInstance(), []);

  // Define handleSubmitNote first
  const handleSubmitNote = useCallback((content: string) => {
    if (!content.trim()) return;
    
    const newNote = {
      id: crypto.randomUUID(),
      content: content.trim()
    };
    
    setNotes(prev => {
      const updatedNotes = [...prev, newNote];
      // Update node data after state update
      updateNode(id, {
        ...data,
        notes: updatedNotes
      });
      return updatedNotes;
    });
  }, [id, data, updateNode]);

  // Initialize notes from data
  useEffect(() => {
    console.log('NotesNode: Initializing notes from data:', data.notes);
    if (data.notes) {
      setNotes(data.notes);
    }
  }, [data.notes]);

  // Initialize node capabilities and communication
  useEffect(() => {
    console.log('NotesNode: Initializing node:', id);
    // Register node capabilities
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'notes',
      metadata: {
        canEdit: true,
        canReceiveNotes: true,
        hasContent: true,
        isEditable: true
      }
    }]);

    // Subscribe to events
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'request'],
      (message) => {
        console.log('NotesNode received message:', message);
        
        switch (message.eventType) {
          case 'connect':
            if (message.metadata?.target === id) {
              console.log('NotesNode: Handling connection from:', message.senderId);
              handleNodeConnection(message.senderId);
              // Send capabilities back to the connecting node
              messageBus.emit('connect', {
                senderId: id,
                receiverId: message.senderId,
                content: 'Connection accepted',
                type: 'connection',
                metadata: {
                  type: 'notes',
                  capabilities: nodeCapabilityService.getCapabilities(id),
                  source: id,
                  target: message.senderId
                }
              });
            }
            break;
          case 'disconnect':
            if (message.metadata?.target === id) {
              handleNodeDisconnection(message.senderId);
            }
            break;
          case 'request':
            if (message.metadata?.type === 'content') {
              handleContentRequest(message.senderId);
            }
            break;
        }
      }
    );

    return () => {
      console.log('NotesNode: Cleaning up node:', id);
      unsubscribe();
      nodeCapabilityService.unregisterNode(id);
    };
  }, [id]);

  // Handle incoming messages
  useEffect(() => {
    console.log('NotesNode: Setting up message handlers for node:', id);
    
    const unsubscribeNoteDraft = nodeMessageService.subscribe(id, 'note_draft', (message: NodeMessage) => {
      console.log('NotesNode: Received note draft:', message);
      
      if (message.content) {
        // Create a new note directly
        const newNote = {
          id: crypto.randomUUID(),
          content: message.content
        };
        
        console.log('NotesNode: Adding new note:', newNote);
        
        // Update notes state and node data
        setNotes(prev => {
          const updatedNotes = [...prev, newNote];
          updateNode(id, {
            ...data,
            notes: updatedNotes
          });
          return updatedNotes;
        });

        // Send confirmation back to sender
        nodeMessageService.sendNoteSave(id, message.senderId, message.content);
      }
    });

    return () => {
      console.log('NotesNode: Cleaning up message handlers');
      unsubscribeNoteDraft();
    };
  }, [id, data, updateNode]);

  const handleNodeConnection = useCallback((nodeId: string) => {
    setConnectedNodes(prev => {
      const updated = new Set(prev);
      updated.add(nodeId);
      return updated;
    });
    
    messageBus.emit('update', {
      senderId: id,
      receiverId: nodeId,
      content: notes.map(note => note.content).join('\n\n'),
      type: 'content',
      metadata: {
        type: 'content',
        nodeType: 'notes'
      }
    });
  }, [id, notes]);

  const handleNodeDisconnection = useCallback((nodeId: string) => {
    setConnectedNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });
  }, []);

  const handleContentRequest = useCallback((requesterId: string) => {
    messageBus.emit('update', {
      senderId: id,
      receiverId: requesterId,
      content: notes.map(note => note.content).join('\n\n'),
      type: 'content',
      metadata: {
        type: 'content',
        nodeType: 'notes'
      }
    });
  }, [id, notes]);

  const handleSaveDraft = useCallback(() => {
    console.log('Saving draft:', draftContent);
    if (!draftContent.trim()) return;

    const newNote = {
      id: crypto.randomUUID(),
      content: draftContent.trim()
    };

    setNotes(prev => {
      const updatedNotes = [...prev, newNote];
      console.log('Updating notes with new draft:', updatedNotes);
      // Update node data
      updateNode(id, {
        ...data,
        notes: updatedNotes,
        hasDraft: false,
        draftContent: ''
      });
      return updatedNotes;
    });

    setIsDraftMode(false);
    setDraftContent('');

    // Notify the sender that the draft was saved
    console.log('Notifying connected nodes about saved draft');
    Array.from(connectedNodes).forEach(nodeId => {
      nodeMessageService.sendNoteSave(id, nodeId, newNote.content);
    });
  }, [id, data, draftContent, connectedNodes, updateNode]);

  const handleDiscardDraft = useCallback(() => {
    setIsDraftMode(false);
    setDraftContent('');
  }, []);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes(prev => {
      const updatedNotes = prev.filter(note => note.id !== noteId);
      // Update node data after state update
      updateNode(id, {
        ...data,
        notes: updatedNotes
      });
      return updatedNotes;
    });
  }, [id, data, updateNode]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmitNote(inputContent);
      setInputContent('');
    }
  }, [inputContent, handleSubmitNote]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '300px',
          width: '300px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Notes {connectedNodes.size > 0 ? `(${connectedNodes.size} connected)` : ''}
          </Typography>
        </Box>

        {isDraftMode ? (
          <>
            <Paper elevation={3} sx={{ p: 1, mb: 1, bgcolor: 'warning.light' }}>
              <Typography variant="body2" sx={{ color: 'warning.dark', mb: 1 }}>
                New note draft received
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                variant="outlined"
                size="small"
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleDiscardDraft}
                >
                  Discard
                </Button>
              </Box>
            </Paper>
          </>
        ) : null}

        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {notes.map((note) => (
              <Paper
                key={note.id}
                sx={{
                  p: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {note.content}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleDeleteNote(note.id)}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  ×
                </Button>
              </Paper>
            ))}
          </Box>
          
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a note and press Enter..."
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyPress={handleKeyPress}
              multiline
              maxRows={4}
            />
          </Box>
        </Paper>
      </Box>
    </BaseNode>
  );
}; 