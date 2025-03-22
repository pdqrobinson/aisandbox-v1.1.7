import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  LinkOff as LinkOffIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
} from '@mui/icons-material';
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
  const [notes, setNotes] = useState<Array<{ id: string; content: string; inContext?: boolean; source?: string }>>([]);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [lastAddedNote, setLastAddedNote] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  const nodeCommunicationService = useMemo(() => NodeCommunicationService.getInstance(), []);

  // Define all handler functions first
  const handleNodeConnection = useCallback((nodeId: string) => {
    console.log('NotesNode: Handling node connection with ID:', nodeId);
    
    if (!nodeId) {
      console.error('NotesNode: Invalid node ID in handleNodeConnection');
      return;
    }
    
    // Check if already connected to avoid duplicates
    if (connectedNodes.has(nodeId)) {
      console.log('NotesNode: Already connected to node:', nodeId);
      return;
    }
    
    console.log('NotesNode: Adding new node connection:', nodeId);
    
    // Update connected nodes state
    setConnectedNodes(prev => {
      const updated = new Set(prev);
      updated.add(nodeId);
      console.log('NotesNode: Updated connected nodes:', Array.from(updated));
      return updated;
    });
    
    // Send current notes content to the connected node
    console.log('NotesNode: Sending notes content to connected node:', nodeId);
    console.log('NotesNode: Current notes:', notes);
    
    // Send a direct update to the node
    messageBus.emit('update', {
      senderId: id,
      receiverId: nodeId,
      content: notes.map(note => note.content).join('\n\n'),
      type: 'content',
      metadata: {
        type: 'content',
        nodeType: 'notesNode',
        notesCount: notes.length,
        capabilities: ['canReceiveNotes', 'canEdit', 'canCommitToContext']
      }
    });
    
    // Also send a specific confirmation that this node can handle notes
    messageBus.emit('connect', {
      senderId: id,
      receiverId: nodeId,
      type: 'connect',
      content: 'Notes node ready',
      metadata: {
        source: id,
        target: nodeId,
        type: 'notes',
        capabilities: ['canReceiveNotes', 'canEdit', 'canCommitToContext']
      }
    });
  }, [id, notes, connectedNodes]);

  const handleNodeDisconnection = useCallback((nodeId: string) => {
    setConnectedNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });
  }, []);

  const handleDisconnectAll = useCallback(() => {
    connectedNodes.forEach(nodeId => {
      messageBus.emit('disconnect', {
        senderId: id,
        receiverId: nodeId,
        type: 'disconnect',
        content: 'Disconnecting notes node',
        metadata: {
          source: id,
          target: nodeId
        }
      });
    });
    setConnectedNodes(new Set());
  }, [id, connectedNodes]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    
    // Notify connected nodes about the deletion
    connectedNodes.forEach(nodeId => {
      messageBus.emit('update', {
        senderId: id,
        receiverId: nodeId,
        type: 'update',
        content: 'Note deleted',
        metadata: {
          action: 'deleteNote',
          noteId
        }
      });
    });
  }, [id, connectedNodes]);

  const handleCommitToContext = useCallback((noteId: string) => {
    // Update the note's inContext status
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, inContext: !note.inContext } : note
    ));
    
    // Find the note
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Notify connected chat nodes about the context change
    connectedNodes.forEach(nodeId => {
      messageBus.emit('update', {
        senderId: id,
        receiverId: nodeId,
        type: 'update',
        content: note.content,
        metadata: {
          action: 'commitToContext',
          noteId,
          inContext: !note.inContext
        }
      });
    });
  }, [id, connectedNodes, notes]);

  const handleSubmitNote = useCallback((content: string) => {
    if (!content.trim()) return;
    
    const noteId = `note-${Date.now()}`;
    const newNote = {
      id: noteId,
      content: content.trim(),
      inContext: false,
      source: 'user'
    };
    
    setNotes(prev => [...prev, newNote]);
    setLastAddedNote(noteId);
    
    // Notify connected nodes about the new note
    connectedNodes.forEach(nodeId => {
      messageBus.emit('update', {
        senderId: id,
        receiverId: nodeId,
        type: 'update',
        content: newNote.content,
        metadata: {
          action: 'addNote',
          noteId: newNote.id,
          source: 'user'
        }
      });
    });
  }, [id, connectedNodes]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmitNote(inputContent);
      setInputContent('');
    }
  }, [inputContent, handleSubmitNote]);

  const handleSaveDraft = useCallback(() => {
    handleSubmitNote(draftContent);
    setDraftContent('');
    setIsDraftMode(false);
  }, [draftContent, handleSubmitNote]);

  const handleDiscardDraft = useCallback(() => {
    setDraftContent('');
    setIsDraftMode(false);
  }, []);

  // Handle incoming note requests from chat nodes
  const handleNoteRequest = useCallback((message: any) => {
    console.log('NotesNode: Received note request:', message);
    
    if (message.metadata?.type === 'addNote') {
      // Create a new note from the request
      const noteId = `note-${Date.now()}`;
      const newNote = {
        id: noteId,
        content: message.content,
        inContext: false,
        source: message.metadata.source_type || 'external'
      };
      
      setNotes(prev => [...prev, newNote]);
      setLastAddedNote(noteId);
      
      // Send confirmation back to the sender
      messageBus.emit('response', {
        senderId: id,
        receiverId: message.senderId,
        type: 'response',
        content: 'Note added successfully',
        metadata: {
          action: 'noteAdded',
          noteId,
          originalRequest: message.id
        }
      });
    }
  }, [id]);

  // Set up event listeners
  useEffect(() => {
    // Subscribe to events from the message bus
    const eventsSubscription = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'request', 'update'],
      (message) => {
        console.log('NotesNode: Received message:', message);
        
        if (message.eventType === 'connect' && message.senderId !== id) {
          handleNodeConnection(message.senderId);
        } else if (message.eventType === 'disconnect') {
          if (message.metadata?.source !== id) {
            handleNodeDisconnection(message.senderId);
          }
        } else if (message.eventType === 'request') {
          // Handle note requests from other nodes
          if (message.metadata?.type === 'addNote') {
            handleNoteRequest(message);
          }
        } else if (message.eventType === 'update') {
          // Handle updates from other nodes
          setLastMessage(message.content);
        }
      }
    );
    
    // Register node capabilities
    nodeCapabilityService.registerCapability(id, 'canReceiveNotes');
    nodeCapabilityService.registerCapability(id, 'canEdit');
    nodeCapabilityService.registerCapability(id, 'canCommitToContext');
    
    // Clean up on unmount
    return () => {
      eventsSubscription();
      nodeCapabilityService.unregisterAllCapabilities(id);
    };
  }, [id, handleNodeConnection, handleNodeDisconnection, handleNoteRequest]);

  // Update node data when notes change
  useEffect(() => {
    updateNode(id, { notes });
  }, [id, notes, updateNode]);

  // Create a component to display connected nodes
  const ConnectedNodesDisplay = () => {
    if (connectedNodes.size === 0) return null;
    
    return (
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Connected to {connectedNodes.size} node{connectedNodes.size !== 1 ? 's' : ''}
        </Typography>
      </Box>
    );
  };

  // Note component
  const Note = ({ note, onDelete }: { note: { id: string; content: string; inContext?: boolean; source?: string }, onDelete: (id: string) => void }) => (
    <Paper
      elevation={1}
      sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: note.inContext ? 'rgba(144, 202, 249, 0.08)' : 'background.paper',
        border: note.inContext ? '1px solid rgba(144, 202, 249, 0.5)' : '1px solid rgba(0,0,0,0.08)',
        position: 'relative',
      }}
    >
      {note.source === 'auto' && (
        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 4, right: 4, fontSize: '0.7rem' }}>
          Auto
        </Typography>
      )}
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {note.content}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 0.5 }}>
        <Button
          size="small"
          variant={note.inContext ? "contained" : "outlined"}
          color={note.inContext ? "primary" : "inherit"}
          onClick={() => handleCommitToContext(note.id)}
          sx={{ textTransform: 'none', minWidth: 0, px: 1, py: 0.5 }}
        >
          {note.inContext ? "In Context" : "Add to Context"}
        </Button>
        <IconButton size="small" onClick={() => onDelete(note.id)} sx={{ color: 'text.secondary' }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );

  return (
    <BaseNode selected={selected} nodeId={id}>
      <Box
        sx={{
          width: 320,
          height: 400,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            bgcolor: 'background.paper',
            color: 'text.primary',
          }}
        >
          <Typography variant="subtitle2" fontWeight="medium" color="text.primary">
            {connectedNodes.size > 0 
              ? `Notes (${notes.length})`
              : "Notes"}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* ID button - more subtle */}
            <Tooltip title={`Node ID: ${id}`}>
              <IconButton
                size="small"
                sx={{ color: 'text.disabled', padding: '2px' }}
                onClick={() => console.log('Notes Node ID:', id)}
              >
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>ID</Typography>
              </IconButton>
            </Tooltip>
          {connectedNodes.size > 0 && (
            <IconButton
              size="small"
              onClick={handleDisconnectAll}
              title="Disconnect All Nodes"
              sx={{
                color: 'text.disabled',
                padding: '2px',
                '&:hover': {
                  color: 'error.main',
                },
              }}
            >
              <LinkOffIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        </Box>
        <ConnectedNodesDisplay />
        {/* Notes List */}
        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 0,
            p: 1.5,
          }}
          elevation={0}
        >
          <Box>
            {notes.length > 0 ? (
              notes.map((note) => (
                <Note key={note.id} note={note} onDelete={handleDeleteNote} />
              ))
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ p: 2, fontSize: '0.85rem' }}
              >
                {connectedNodes.size > 0 
                  ? "No notes yet. Use the 'Take note' button in the connected chat node."
                  : "No notes yet. Connect to a chat node to take notes."}
                {connectedNodes.size > 0 && (
                <Typography
                    variant="caption" 
                    display="block" 
                    color="text.secondary" 
                    sx={{ mt: 1, fontStyle: 'italic', fontSize: '0.75rem' }}
                  >
                    Ready to receive notes from connected node(s)
                  </Typography>
                )}
                </Typography>
            )}
          </Box>
        </Paper>
        {/* Draft Mode */}
        {isDraftMode ? (
          <Box sx={{ p: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Enter your draft note..."
              sx={{ mb: 1 }}
              size="small"
              variant="outlined"
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={handleDiscardDraft}
                color="inherit"
                sx={{ textTransform: 'none' }}
              >
                Discard
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveDraft}
                disabled={!draftContent.trim()}
                sx={{ textTransform: 'none' }}
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
              borderTop: '1px solid rgba(0,0,0,0.08)',
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
              maxRows={3}
              variant="outlined"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
            />
            <Button
              variant="contained"
              onClick={() => {
                handleSubmitNote(inputContent);
                setInputContent('');
              }}
              disabled={!inputContent.trim()}
              sx={{ textTransform: 'none' }}
            >
              Add
            </Button>
          </Box>
        )}
      </Box>
    </BaseNode>
  );
};
