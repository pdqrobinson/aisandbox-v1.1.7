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
  const [notes, setNotes] = useState<Array<{ id: string; content: string; inContext?: boolean }>>([]);
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
        capabilities: ['canReceiveNotes', 'canEdit']
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
        capabilities: ['canReceiveNotes', 'canEdit']
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
      
      // Also save to localStorage as a backup
      try {
        localStorage.setItem(`notes-${id}`, JSON.stringify(updatedNotes));
        console.log('NotesNode: Saved notes to localStorage');
      } catch (err) {
        console.error('NotesNode: Failed to save to localStorage:', err);
      }
      
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
    console.log('NotesNode: Deleting note with ID:', noteId);
    
    setNotes(prev => {
      const filteredNotes = prev.filter(note => note.id !== noteId);
      console.log('NotesNode: Updated notes after deletion:', filteredNotes);
      
      // Update node data
      updateNode(id, {
        ...data,
        notes: filteredNotes
      });
      
      return filteredNotes;
    });
  }, [id, data, updateNode]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmitNote(inputContent);
      setInputContent('');
    }
  }, [inputContent, handleSubmitNote]);

  const handleSendToAI = useCallback((noteContent: string) => {
    console.log('NotesNode: Sending note to AI:', noteContent);
    
    if (connectedNodes.size === 0) {
      console.warn('NotesNode: No chat nodes connected to send note to AI');
      return;
    }
    
    // Send note to all connected nodes
    Array.from(connectedNodes).forEach(nodeId => {
      messageBus.emit('send_to_ai', {
        senderId: id,
        receiverId: nodeId,
        type: 'context',
        content: noteContent,
        metadata: {
          type: 'note_context',
          source: id,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('NotesNode: Sent note to AI via node:', nodeId);
    });
    
    // Show feedback
    setLastMessage('Note sent to AI');
    setTimeout(() => setLastMessage(null), 3000);
  }, [id, connectedNodes]);

  const handleToggleContext = useCallback((noteId: string, noteContent: string) => {
    console.log('NotesNode: Toggling note in AI context:', noteId);
    
    // Update the note's status in the state
    setNotes(prev => {
      const updatedNotes = prev.map(note => 
        note.id === noteId ? { ...note, inContext: !note.inContext } : note
      );
      
      // Also update the node data for persistence
      updateNode(id, {
        ...data,
        notes: updatedNotes
      });
      
      return updatedNotes;
    });
    
    if (connectedNodes.size === 0) {
      console.warn('NotesNode: No chat nodes connected for context update');
      return;
    }
    
    // Find the note to check if it's being added or removed from context
    const note = notes.find(n => n.id === noteId);
    const adding = !note?.inContext; // If it's currently not in context, we're adding it
    
    // Send context update to all connected chat nodes
    Array.from(connectedNodes).forEach(nodeId => {
      messageBus.emit('send_to_ai', {
        senderId: id,
        receiverId: nodeId,
        type: 'context',
        content: noteContent,
        metadata: {
          type: 'note_context',
          source: id,
          action: adding ? 'add' : 'remove',
          noteId: noteId,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`NotesNode: ${adding ? 'Added to' : 'Removed from'} AI context via node:`, nodeId);
    });
    
    // Show feedback
    setLastMessage(`Note ${adding ? 'added to' : 'removed from'} AI context`);
    setTimeout(() => setLastMessage(null), 3000);
  }, [id, connectedNodes, notes, data, updateNode]);

  // Process incoming note requests
  useEffect(() => {
    console.log('NotesNode: Setting up note request handler');
    console.log('NotesNode: ID:', id);
    
    const handleNoteRequest = (message) => {
      console.log('NotesNode: Received request message:', JSON.stringify(message, null, 2));
      
      // Update last message received for debugging
      setLastMessage(`Received: ${message.type || message.eventType} from ${message.senderId}`);
      setTimeout(() => setLastMessage(null), 5000);
      
      // Handle different message formats
      let processedMessage = message;
      
      // Normalize message format if needed
      if (message.eventType && !message.type) {
        processedMessage = { ...message, type: message.eventType };
      }
      
      if (message.data && typeof message.data === 'object') {
        processedMessage = { ...processedMessage, ...message.data };
      }
      
      // Skip messages not for this node
      const targetId = processedMessage.receiverId || processedMessage.metadata?.target;
      if (targetId && targetId !== id) {
        console.log('NotesNode: Skipping message not for this node:', targetId, 'vs', id);
        return;
      }
      
      // Extract metadata from various formats
      const metadata = processedMessage.metadata || {};
      const requestType = metadata.type || processedMessage.requestType;
      
      // Handle note adding requests
      if ((processedMessage.type === 'request' && requestType === 'addNote') || 
          (processedMessage.action === 'addNote')) {
        console.log('NotesNode: Processing addNote request', {
          content: processedMessage.content,
          from: processedMessage.senderId,
          metadata: metadata
        });
        
        try {
          // Create a properly formatted note
          const newNote = {
            id: metadata.noteId || crypto.randomUUID(),
            content: processedMessage.content,
            timestamp: metadata.timestamp || Date.now(),
            source: metadata.source || 'unknown',
            author: metadata.author || 'User'
          };
          
          console.log('NotesNode: About to add new note:', newNote);
          
          // Update state and node data
          setNotes(prev => {
            console.log('NotesNode: Previous notes:', prev);
            
            // Check if note already exists by ID
            if (prev.some(note => note.id === newNote.id)) {
              console.log('NotesNode: Note with this ID already exists, skipping');
              return prev;
            }
            
            const updatedNotes = [...prev, newNote];
            console.log('NotesNode: Updated notes:', updatedNotes);
            
            // Update node data - this is crucial for persistence
            updateNode(id, {
              ...data,
              notes: updatedNotes
            });
            
            // Also save to localStorage as a backup
            try {
              localStorage.setItem(`notes-${id}`, JSON.stringify(updatedNotes));
              console.log('NotesNode: Saved notes to localStorage after adding new note');
            } catch (err) {
              console.error('NotesNode: Failed to save to localStorage:', err);
            }
            
            return updatedNotes;
          });
          
          // Set the last added note for feedback
          setLastAddedNote(processedMessage.content.substring(0, 30) + (processedMessage.content.length > 30 ? '...' : ''));
          setTimeout(() => setLastAddedNote(null), 3000);
          
          // Send confirmation using messageBus
          console.log('NotesNode: Sending confirmation to', processedMessage.senderId);
          messageBus.emit('update', {
            senderId: id,
            receiverId: processedMessage.senderId,
            type: 'note_save',
            content: 'Note added successfully',
            metadata: {
              success: true,
              noteId: newNote.id,
              timestamp: Date.now()
            }
          });
          
          console.log('NotesNode: Note successfully added, confirmation sent');
        } catch (error) {
          console.error('NotesNode: Error adding note:', error);
          
          // Send error message
          messageBus.emit('update', {
            senderId: id,
            receiverId: processedMessage.senderId,
            type: 'note_save',
            content: 'Failed to add note',
            metadata: {
              success: false,
              error: error.message || 'Unknown error',
              timestamp: Date.now()
            }
          });
        }
      } else if (processedMessage.type === 'request' && requestType === 'ping') {
        // Handle ping requests
        console.log('NotesNode: Received ping from:', processedMessage.senderId);
        handleNodeConnection(processedMessage.senderId);
      } else if (processedMessage.type === 'connection_check') {
        // Handle connection check requests
        console.log('NotesNode: Received connection check from:', processedMessage.senderId);
        handleNodeConnection(processedMessage.senderId);
      } else {
        console.log('NotesNode: Received unhandled request type:', processedMessage);
      }
    };
    
    // Debug - log all request events
    console.log('NotesNode: Setting up request event listeners');
    
    // Try different subscription methods for reliability
    
    // 1. Subscribe directly to messageBus for 'request' events
    const requestUnsubscribe = messageBus.subscribe('request', handleNoteRequest);
    console.log('NotesNode: Set up primary request listener');
    
    // 2. Also subscribe to the messageBus using general event handler for fallback
    const generalUnsubscribe = messageBus.subscribe(id, (message) => {
      console.log('NotesNode: Received general message:', JSON.stringify(message, null, 2));
      
      if (message.eventType === 'request' && (message.receiverId === id || !message.receiverId)) {
        console.log('NotesNode: Processing request from general handler');
        handleNoteRequest(message);
      }
    });
    console.log('NotesNode: Set up secondary general message listener');
    
    // 3. Another catch-all listener for any events
    const catchAllUnsubscribe = messageBus.subscribe(null, (message) => {
      console.log('NotesNode: [CATCH-ALL] Received general event:', message.eventType);
      
      if ((message.eventType === 'request' || message.type === 'request') && 
          (message.receiverId === id || message.metadata?.target === id)) {
        console.log('NotesNode: [CATCH-ALL] Found relevant request for this node');
        handleNoteRequest(message);
      }
    });
    
    // 4. Add a window message event listener as a backup channel
    const windowMessageHandler = (event) => {
      if (event.data && 
        ((event.data.type === 'node_message' && event.data.eventType === 'request') ||
         (event.data.action === 'addNote'))) {
        console.log('NotesNode: Received window.postMessage event:', event.data);
        
        if (event.data.receiverId === id || event.data.targetId === id || !event.data.receiverId) {
          console.log('NotesNode: Processing window.postMessage request for this node');
          handleNoteRequest(event.data);
        }
      }
    };
    window.addEventListener('message', windowMessageHandler);
    console.log('NotesNode: Set up window.postMessage listener');
    
    return () => {
      console.log('NotesNode: Cleaning up request event listeners');
      requestUnsubscribe();
      generalUnsubscribe();
      catchAllUnsubscribe();
      window.removeEventListener('message', windowMessageHandler);
    };
  }, [id, data, updateNode, handleNodeConnection]);
  
  // Log notes whenever they change
  useEffect(() => {
    console.log('NotesNode: Current notes:', notes);
  }, [notes]);

  // Register as a notes node when created
  useEffect(() => {
    console.log('NotesNode: Registering as notes node:', id);
    
    // Basic capability registration
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'notes', 
      metadata: {
        type: 'notes',
        canReceiveNotes: true
      }
    }]);
    
    return () => {
      console.log('NotesNode: Unregistering node:', id);
      nodeCapabilityService.unregisterNode(id);
    };
  }, [id]);

  // Initialize notes from data and localStorage
  useEffect(() => {
    // First check if there are notes in the data
    if (data.notes && data.notes.length > 0) {
    console.log('NotesNode: Initializing notes from data:', data.notes);
      setNotes(data.notes);
      
      // Also save to localStorage
      try {
        localStorage.setItem(`notes-${id}`, JSON.stringify(data.notes));
      } catch (err) {
        console.error('NotesNode: Failed to save to localStorage:', err);
      }
    } else {
      // Try to load from localStorage if no data notes
      try {
        const savedNotes = localStorage.getItem(`notes-${id}`);
        if (savedNotes) {
          const parsedNotes = JSON.parse(savedNotes);
          console.log('NotesNode: Loaded notes from localStorage:', parsedNotes);
          setNotes(parsedNotes);
          
          // Update node data
          updateNode(id, {
            ...data,
            notes: parsedNotes
          });
        }
      } catch (err) {
        console.error('NotesNode: Failed to load from localStorage:', err);
      }
    }
  }, [id, data, updateNode]);

  // Initialize node capabilities and communication
  useEffect(() => {
    console.log('NotesNode: Initializing node:', id);
    
    // Register capabilities with explicit type
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'notes',
      metadata: {
        type: 'notes',
        canEdit: true,
        canReceiveNotes: true,
        hasContent: true,
        isEditable: true
      }
    }]);

    const handleNodeEvents = (message: any) => {
      console.log('NotesNode: Received message:', message);
        
        switch (message.eventType) {
          case 'connect':
            if (message.metadata?.target === id) {
            console.log('NotesNode: Processing connection from:', message.senderId);
            // Send connection acknowledgment with explicit type
              messageBus.emit('connect', {
                senderId: id,
                receiverId: message.senderId,
              type: 'connect',
                metadata: {
                type: 'notes',
                sourceType: 'notes',
                  source: id,
                target: message.senderId,
                capabilities: ['edit', 'receiveNotes', 'content']
              }
            });
            handleNodeConnection(message.senderId);
            }
            break;
          case 'disconnect':
            if (message.metadata?.target === id) {
            console.log('NotesNode: Handling disconnection from:', message.senderId);
              handleNodeDisconnection(message.senderId);
            }
            break;
      }
    };

    const eventsSubscription = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'request'],
      handleNodeEvents
    );

    return () => {
      console.log('NotesNode: Cleaning up node:', id);
      eventsSubscription();
      nodeCapabilityService.unregisterNode(id);
    };
  }, [id, handleNodeConnection, handleNodeDisconnection, data, updateNode]);

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

        // Send detailed confirmation
        nodeMessageService.sendNoteSave(id, message.senderId, message.content, {
          noteId: newNote.id,
          success: true,
          timestamp: Date.now()
        });
      }
    });

    return () => {
      console.log('NotesNode: Cleaning up message handlers');
      unsubscribeNoteDraft();
    };
  }, [id, data, updateNode]);

  // Add a direct connection detection that's specifically tuned for direct events
  useEffect(() => {
    console.log('NotesNode: Setting up DIRECT connection detection via messageBus');
    
    const handleDirectConnect = (event) => {
      console.log('NotesNode: Received direct messageBus connect event:', event);
      
      // First check for ReactFlow-style connect events
      if (event.source && event.target) {
        if (event.source === id || event.target === id) {
          const otherNodeId = event.source === id ? event.target : event.source;
          console.log('NotesNode: DIRECT connection detected with node:', otherNodeId);
          handleNodeConnection(otherNodeId);
        }
        return;
      }
      
      // Handle MessageBus style events
      if ((event.senderId && event.receiverId === id) || 
          (event.receiverId && event.senderId === id)) {
        const otherNodeId = event.senderId === id ? event.receiverId : event.senderId;
        console.log('NotesNode: MessageBus style connection detected with node:', otherNodeId);
        handleNodeConnection(otherNodeId);
        return;
      }
      
      // Handle classic message style connect events
      if (event.metadata && 
          ((event.metadata.source === id && event.metadata.target) || 
           (event.metadata.target === id && event.metadata.source))) {
        const otherNodeId = event.metadata.source === id ? event.metadata.target : event.metadata.source;
        console.log('NotesNode: Metadata style connection detected with node:', otherNodeId);
        handleNodeConnection(otherNodeId);
        return;
      }
    };
    
    // Subscribe directly to messageBus for all 'connect' events
    console.log('NotesNode: Subscribing to connect events via messageBus');
    const connectUnsubscribe = messageBus.subscribe('connect', handleDirectConnect);
    
    return () => {
      console.log('NotesNode: Cleaning up direct connect listener');
      connectUnsubscribe();
    };
  }, [id, handleNodeConnection]);

  // Check for existing connections using ReactFlow on mount
  useEffect(() => {
    console.log('NotesNode: Checking for existing connections on mount');
    
    // Wait a bit for ReactFlow to be ready
    const checkTimer = setTimeout(() => {
      try {
        // Try to get ReactFlow instance from window or using a direct DOM query
        let reactFlowInstance = (window as any).reactFlowInstance;
        
        if (!reactFlowInstance) {
          // Try to find it in the DOM
          const rfWrapper = document.querySelector('div[data-testid="rf__wrapper"]');
          if (rfWrapper && (rfWrapper as any).__reactProps$) {
            reactFlowInstance = (rfWrapper as any).__reactProps$.children.props.value;
          }
        }
        
        if (reactFlowInstance) {
          const edges = reactFlowInstance.getEdges();
          console.log('NotesNode: Found edges on mount:', edges);
          
          // Find edges connected to this node
          const nodeEdges = edges.filter(
            edge => edge.source === id || edge.target === id
          );
          
          console.log('NotesNode: Found connected edges on mount:', nodeEdges);
          
          // Register each connection
          for (const edge of nodeEdges) {
            const otherNodeId = edge.source === id ? edge.target : edge.source;
            console.log('NotesNode: Found existing connection to node:', otherNodeId);
            handleNodeConnection(otherNodeId);
          }
        } else {
          console.log('NotesNode: ReactFlow instance not found on mount');
          
          // Fallback: broadcast presence to try to initiate connections
          messageBus.emit('connect', {
            senderId: id,
            type: 'connect',
            content: 'Notes node broadcasting presence',
            metadata: {
              source: id,
              type: 'notes',
              capabilities: ['canReceiveNotes', 'canEdit']
            }
          });
        }
      } catch (err) {
        console.error('NotesNode: Error checking connections on mount:', err);
      }
    }, 1000); // Delay to ensure ReactFlow is ready
    
    return () => {
      clearTimeout(checkTimer);
    };
  }, [id, handleNodeConnection]);

  // Add a debug component that shows connected nodes
  const ConnectedNodesDisplay = () => {
    const nodesList = Array.from(connectedNodes);
    
    if (nodesList.length === 0) return null;
    
    return (
      <Box sx={{ 
        p: 0.75, 
        borderBottom: '1px solid rgba(0,0,0,0.08)', 
        bgcolor: 'background.paper'
      }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
          {nodesList.length} connection{nodesList.length !== 1 ? 's' : ''}
        </Typography>
        {lastAddedNote && (
          <Box sx={{ 
            mt: 0.5, 
            p: 0.5, 
            bgcolor: 'background.paper', 
            color: 'text.secondary',
            borderRadius: 0.5,
            fontSize: '0.7rem',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 'normal', fontSize: '0.7rem' }}>
              Note added
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const Note = ({ note, onDelete }) => (
    <Box
      sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid',
        borderColor: note.inContext ? 'primary.main' : 'rgba(0,0,0,0.05)',
        ...(note.inContext && {
          bgcolor: 'primary.lightest',
        }),
        '&:hover': {
          boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        },
        '&:hover .note-action-buttons': {
          opacity: 1, // Always show buttons on hover
        }
      }}
    >
      {/* Note Header with metadata */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 0.75, 
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        pb: 0.75,
        pr: 5 // Make space for the action buttons
      }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.7rem'
          }}
        >
          {note.author || 'User'} • {note.source === 'auto' ? 'Auto' : 'Manual'}
          {note.inContext && (
            <Typography 
              component="span" 
              sx={{ 
                ml: 1, 
                color: 'primary.main',
                fontSize: '0.7rem',
                fontWeight: 'medium'
              }}
            >
              • In AI Context
            </Typography>
          )}
        </Typography>
        
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
          {new Date(note.timestamp).toLocaleString()}
        </Typography>
      </Box>

      {/* Note Content */}
      <Typography
        variant="body2"
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pt: 0.5,
          color: 'text.primary',
          lineHeight: 1.4,
          pr: 5 // Make space for the action buttons
        }}
      >
        {note.content}
      </Typography>
      
      {/* Action Buttons */}
      <Box
        className="note-action-buttons"
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          opacity: { xs: 0.8, sm: 0 }, // More visible on mobile by default
          transition: 'opacity 0.2s',
          display: 'flex',
          gap: '4px',
          zIndex: 10, // Ensure buttons are above other content
          backgroundColor: 'rgba(255,255,255,0.7)', // Semi-transparent background for better visibility
          borderRadius: '4px',
          padding: '2px',
        }}
      >
        {/* Toggle AI Context Button */}
        <Tooltip title={note.inContext ? "Remove from AI context" : "Add to AI context"}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              handleToggleContext(note.id, note.content);
            }}
            disabled={connectedNodes.size === 0}
            sx={{ 
              padding: '6px',  // Increase padding for larger click area
              color: note.inContext 
                ? 'primary.main' 
                : connectedNodes.size > 0 ? 'text.secondary' : 'text.disabled',
              '&:hover': {
                color: note.inContext ? 'primary.dark' : 'primary.main',
                bgcolor: 'primary.lightest'
              }
            }}
          >
            <SendIcon 
              fontSize="small" 
              sx={{
                transform: note.inContext ? 'rotate(-90deg)' : 'none',
                transition: 'transform 0.2s ease-in-out'
              }}
            />
          </IconButton>
        </Tooltip>
        
        {/* Delete Button */}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            onDelete(note.id);
          }}
          sx={{ 
            padding: '6px',  // Increase padding for larger click area
            color: 'text.disabled',
            '&:hover': {
              color: 'error.main',
              bgcolor: 'error.lightest'
            }
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );

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