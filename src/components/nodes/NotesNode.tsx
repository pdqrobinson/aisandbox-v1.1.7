import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  Paper,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import { LinkOff as LinkOffIcon, Delete as DeleteIcon } from '@mui/icons-material';
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

  // Define all handler functions first
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
        nodeType: 'notesNode'
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
        nodeType: 'notesNode'
      }
    });
  }, [id, notes]);

  const handleSubmitNote = useCallback((content: string) => {
    if (!content.trim()) return;
    
    const newNote = {
      id: crypto.randomUUID(),
      content: content.trim()
    };
    
    setNotes(prev => {
      const updatedNotes = [...prev, newNote];
      updateNode(id, {
        ...data,
        notes: updatedNotes
      });
      return updatedNotes;
    });
  }, [id, data, updateNode]);

  const handleDisconnectAll = useCallback(() => {
    Array.from(connectedNodes).forEach(nodeId => {
      messageBus.emit('disconnect', {
        senderId: id,
        receiverId: nodeId,
        type: 'disconnect',
        metadata: {
          type: 'notesNode',
          source: id,
          target: nodeId
        }
      });
    });

    setConnectedNodes(new Set());
  }, [id, connectedNodes]);

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
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'notesNode',
      metadata: {
        canEdit: true,
        canReceiveNotes: true,
        hasContent: true,
        isEditable: true
      }
    }]);

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
              messageBus.emit('connect', {
                senderId: id,
                receiverId: message.senderId,
                content: 'Connection accepted',
                type: 'connection',
                metadata: {
                  type: 'notesNode',
                  capabilities: nodeCapabilityService.getCapabilities(id),
                  source: id,
                  target: message.senderId
                }
              });

              messageBus.emit('update', {
                senderId: id,
                receiverId: message.senderId,
                content: notes.map(note => note.content).join('\n\n'),
                type: 'content',
                metadata: {
                  type: 'content',
                  nodeType: 'notesNode'
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
  }, [id, notes, handleNodeConnection, handleNodeDisconnection, handleContentRequest]);

  // Handle incoming messages
  useEffect(() => {
    console.log('NotesNode: Setting up message handlers for node:', id);
    
    const unsubscribeNoteDraft = nodeMessageService.subscribe(id, 'note_draft', (message: NodeMessage) => {
      console.log('NotesNode: Received note draft:', message);
      
      if (message.content) {
        const newNote = {
          id: crypto.randomUUID(),
          content: message.content
        };
        
        console.log('NotesNode: Adding new note:', newNote);
        
        setNotes(prev => {
          const updatedNotes = [...prev, newNote];
          updateNode(id, {
            ...data,
            notes: updatedNotes
          });
          return updatedNotes;
        });

        nodeMessageService.sendNoteSave(id, message.senderId, message.content);
      }
    });

    return () => {
      console.log('NotesNode: Cleaning up message handlers');
      unsubscribeNoteDraft();
    };
  }, [id, data, updateNode]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="subtitle2">
            {connectedNodes.size} connected node{connectedNodes.size !== 1 ? 's' : ''}
          </Typography>
          {connectedNodes.size > 0 && (
            <IconButton
              size="small"
              onClick={handleDisconnectAll}
              title="Disconnect All Nodes"
              sx={{
                color: 'error.main',
                '&:hover': {
                  backgroundColor: 'error.main',
                  color: 'error.contrastText',
                },
              }}
            >
              <LinkOffIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Notes List */}
        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 0,
          }}
        >
          <Box sx={{ p: 1 }}>
            {notes.map((note) => (
              <Paper
                key={note.id}
                sx={{
                  p: 1,
                  mb: 1,
                  position: 'relative',
                  '&:hover .delete-button': {
                    opacity: 1,
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    pr: 4, // Make room for delete button
                  }}
                >
                  {note.content}
                </Typography>
                <IconButton
                  className="delete-button"
                  size="small"
                  onClick={() => handleDeleteNote(note.id)}
                  sx={{
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    color: 'error.main',
                    '&:hover': {
                      backgroundColor: 'error.main',
                      color: 'error.contrastText',
                    },
                  }}
                  title="Delete note"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Paper>
            ))}
          </Box>
        </Paper>

        {/* Draft Mode */}
        {isDraftMode ? (
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Enter your draft note..."
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={handleDiscardDraft}
                color="inherit"
              >
                Discard
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveDraft}
                disabled={!draftContent.trim()}
              >
                Save
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              p: 1,
              gap: 1,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <TextField
              fullWidth
              size="small"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a note and press Enter..."
              multiline
              maxRows={4}
            />
            <Button
              variant="contained"
              onClick={() => {
                handleSubmitNote(inputContent);
                setInputContent('');
              }}
              disabled={!inputContent.trim()}
            >
              Add
            </Button>
          </Box>
        )}
      </Box>
    </BaseNode>
  );
}; 