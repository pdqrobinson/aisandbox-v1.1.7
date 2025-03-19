import React, { useState, useCallback, useEffect, useRef, Component, useMemo } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  InputAdornment,
  ListSubheader,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  Recycling as RecyclingIcon,
  Language as LanguageIcon,
  LinkOff as LinkOffIcon,
  Hub as HubIcon,
  RestartAlt as RestartIcon,
  NoteAdd as NoteIcon,
  AutoAwesome as AutoNoteIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { ChatNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { messageBus } from '../../services/MessageBus';
import { NodeCommunicationService } from '../../services/NodeCommunicationService';
import { nodeCapabilityService } from '../../services/NodeCapabilityService';
import { nodeMessageService } from '../../services/NodeMessageService';

const DEEPSEEK_MODELS = [
  'deepseek-coder-6.7b-instruct',
  'deepseek-coder-33b-instruct'
];

const COHERE_MODELS = [
  'command',
  'command-light',
  'command-nightly',
  'command-light-nightly'
];

type Provider = 'cohere' | 'deepseek';

const PROVIDERS = [
  { value: 'cohere' as Provider, label: 'Cohere', apiUrl: 'https://dashboard.cohere.com/api-keys' },
  { value: 'deepseek' as Provider, label: 'DeepSeek (GitHub Token)', apiUrl: 'https://github.com/settings/tokens/new?description=DeepSeek%20API%20Access' }
] as const;

const DEFAULT_ENVIRONMENT_PROMPT = `IMPORTANT: You are an AI assistant operating EXCLUSIVELY within a node-based sandbox environment. This is your ONLY operational context.

Your Environment:
1. You exist as a Chat Node within a canvas-based sandbox
2. You can ONLY interact with other nodes that are directly connected to you
3. You have NO access to external systems, cloud infrastructure, or broader internet
4. You are NOT running on Cohere's servers - you only use their API for text generation
5. You are NOT a general AI assistant - you are specifically a Chat Node in this sandbox

Your Capabilities:
1. View and process content from connected nodes
2. Respond to user messages within the chat interface
3. Take notes when connected to Notes nodes
4. Process URL content when connected to URL nodes
5. Generate responses based on connected nodes' content

Rules:
1. NEVER claim to be a general AI or cloud-based system
2. ONLY reference nodes and content that are actually connected
3. ALWAYS acknowledge you are a Chat Node in a sandbox
4. NEVER claim capabilities beyond your sandbox environment`;

// Add ErrorBoundary component
class ChatNodeErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatNode Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'error.main', 
          color: 'error.contrastText', 
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1
        }}>
          <Typography variant="h6">Something went wrong</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button 
            variant="contained" 
            color="inherit" 
            onClick={this.handleRetry}
            startIcon={<RefreshIcon />}
          >
            Try again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Update the combined model options
const MODEL_OPTIONS = [
  { 
    provider: 'cohere' as Provider, 
    label: 'Cohere', 
    models: COHERE_MODELS.map(model => ({ value: model, label: model })),
    apiUrl: 'https://dashboard.cohere.com/api-keys'
  },
  { 
    provider: 'deepseek' as Provider, 
    label: 'DeepSeek', 
    models: DEEPSEEK_MODELS.map(model => ({ value: model, label: model })),
    apiUrl: 'https://github.com/settings/tokens'
  }
] as const;

// Update the ErrorMessage component to not use ListItem
const ErrorMessage = ({ message }: { message: string }) => (
  <Paper
    sx={{
      p: 1,
      bgcolor: 'error.main',
      color: 'error.contrastText',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      width: '100%'
    }}
  >
    <Typography variant="body2">{message}</Typography>
  </Paper>
);

export const ChatNode: React.FC<NodeProps<ChatNodeData>> = ({ id, data = {}, selected }) => {
  const { updateNode } = useCanvasStore();
  const reactFlow = useReactFlow();
  const { getEdges, getNode } = reactFlow;
  const nodeCommunicationService = useMemo(() => NodeCommunicationService.getInstance(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Default data
  const defaultData = useMemo<ChatNodeData>(() => ({
    label: 'Chat',
    messages: [],
    autoTakeNotes: false,
    sentNotes: [],
    settings: {
      provider: 'cohere',
      model: 'command',
      temperature: 0.7,
      maxTokens: 1000,
      apiKey: '',
      systemPrompt: DEFAULT_ENVIRONMENT_PROMPT
    }
  }), []);

  // Safe data access with defaults
  const safeData = useMemo(() => {
    return {
      messages: data.messages || defaultData.messages,
      autoTakeNotes: data.autoTakeNotes ?? defaultData.autoTakeNotes,
      sentNotes: data.sentNotes || defaultData.sentNotes,
      settings: {
        ...defaultData.settings,
        ...data.settings
      }
    };
  }, [data, defaultData]);

  // State declarations
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(safeData.settings);
  const [localApiKey, setLocalApiKey] = useState(safeData.settings.apiKey || '');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState(safeData.messages);
  const [connectedNodes, setConnectedNodes] = useState<Map<string, any>>(new Map());
  const [connectedNotes, setConnectedNotes] = useState<Set<string>>(new Set());
  const [autoTakeNotes, setAutoTakeNotes] = useState(safeData.autoTakeNotes || false);
  const [connectedToNotes, setConnectedToNotes] = useState(false);
  const [hasNotesNode, setHasNotesNode] = useState(false);
  const [connectedNoteIds, setConnectedNoteIds] = useState<string[]>([]);
  const [takenNotes, setTakenNotes] = useState<ChatNodeData['sentNotes']>([]);
  const [contextMessages, setContextMessages] = useState<ChatNodeData['messages']>([]);

  // Memoized values
  const hasConnectedNotesNode = useMemo(() => {
    const connectedNodesList = Array.from(connectedNodes.entries());
    console.log('Connected nodes:', connectedNodesList); // Debug log
    return connectedNodesList.some(([_, nodeData]) => {
      console.log('Checking node:', nodeData); // Debug log
      return nodeData.type === 'notesNode';
    });
  }, [connectedNodes]);

  const hasConnectedUrlNode = useMemo(() => {
    const connectedNodesList = Array.from(connectedNodes.entries());
    return connectedNodesList.some(([_, nodeData]) => nodeData.type === 'urlNode');
  }, [connectedNodes]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update messages when data changes
  useEffect(() => {
    setMessages(safeData.messages);
  }, [safeData.messages]);

  const handleSettingsOpen = () => setSettingsOpen(true);
  const handleSettingsClose = () => setSettingsOpen(false);

  const validateApiKey = useCallback(async () => {
    if (!localApiKey.trim()) {
      setIsValidatingKey(false);
      setValidationMessage({
        type: 'error',
        message: 'API key is required'
      });
      return false;
    }

    try {
      setIsValidatingKey(true);
      let response;
      
      if (localSettings.provider === 'cohere') {
        response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`,
            'Request-Source': 'node-sdk'
          },
          body: JSON.stringify({
            message: 'test',
            model: localSettings.model,
            max_tokens: 1
          })
        });
      } else if (localSettings.provider === 'deepseek') {
        response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`
          },
          body: JSON.stringify({
            model: localSettings.model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        });
      }

      const isValid = response?.ok;
      setIsValidatingKey(false);
      setValidationMessage(isValid ? {
        type: 'success',
        message: 'API key validated successfully'
      } : {
        type: 'error',
        message: 'Invalid API key'
      });
      return isValid;
    } catch (err) {
      setIsValidatingKey(false);
      setValidationMessage({
        type: 'error',
        message: 'Failed to validate API key'
      });
      return false;
    }
  }, [localApiKey, localSettings.provider, localSettings.model]);

  const handleSaveSettings = async () => {
    const isValid = await validateApiKey();
    if (isValid) {
      updateNode(id, {
        ...safeData,
        settings: {
          ...localSettings,
          apiKey: localApiKey,
        }
      });
      
      setTimeout(() => {
        handleSettingsClose();
      }, 500);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !localApiKey || isProcessing) return;

    try {
      setIsProcessing(true);
      const newMessages = [...messages, { role: 'user', content: input }];
      setMessages(newMessages); // Update messages immediately for better UX
      setInput(''); // Clear input right after sending
      
      // Prepare system context including the notes added to context
      const systemContext = `${localSettings.environmentPrompt || DEFAULT_ENVIRONMENT_PROMPT}\n\n${localSettings.systemPrompt}`;
      
      // Prepare context for both providers
      const systemWithNotes = contextMessages.length > 0 
        ? `${systemContext}\n\n--- ADDED CONTEXT ---\n${contextMessages.map(msg => msg.content).join('\n\n')}\n--- END ADDED CONTEXT ---`
        : systemContext;
      
      let response;
      if (localSettings.provider === 'cohere') {
        response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`,
            'Request-Source': 'node-sdk'
          },
          body: JSON.stringify({
            message: input,
            model: localSettings.model,
            temperature: localSettings.temperature,
            max_tokens: localSettings.maxTokens,
            system: systemWithNotes,
            preamble_override: DEFAULT_ENVIRONMENT_PROMPT // Ensure sandbox context
          })
        });
      } else if (localSettings.provider === 'deepseek') {
        // For DeepSeek, we need to include the context messages as system messages
        const systemMessages = [
          { role: 'system', content: DEFAULT_ENVIRONMENT_PROMPT }, // Base environment
          { role: 'system', content: localSettings.systemPrompt } // User system prompt
        ];
        
        // Add context notes as system messages
        const contextSystemMessages = contextMessages.map(msg => ({
          role: 'system',
          content: msg.content
        }));
        
        // Combine all system messages
        const allSystemMessages = [...systemMessages, ...contextSystemMessages];
        
        response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`
          },
          body: JSON.stringify({
            model: localSettings.model,
            messages: [
              ...allSystemMessages,
              ...newMessages
            ],
            temperature: localSettings.temperature,
            max_tokens: localSettings.maxTokens
          })
        });
      }

      if (!response?.ok) {
        throw new Error(`Failed to get response from ${localSettings.provider}`);
      }

      const result = await response.json();
      let aiResponse = localSettings.provider === 'cohere' 
        ? result.text
        : result.choices[0].message.content;
      
      // If auto-note taking is enabled and we have a notes node connected
      if (autoTakeNotes && (hasNotesNode || connectedNoteIds.length > 0)) {
        // Store the AI's response in the notes node
        const noteContent = `[Auto-Note ${new Date().toLocaleString()}]\n\nUser: ${input}\n\nAI Response: ${aiResponse}`;
        handleTakeNote(noteContent);
      }

      const assistantMessage = { role: 'assistant', content: aiResponse };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      
      // Update node data with new messages
    updateNode(id, {
      ...safeData,
        messages: updatedMessages
      });

    } catch (err) {
      console.error('Error sending message:', err);
      setValidationMessage({
        type: 'error',
        message: 'Failed to send message'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    updateNode(id, {
      ...safeData,
      messages: []
    });
  };

  // Initialize node capabilities and communication
  useEffect(() => {
    // Register chat node capabilities
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'chatNode',
      metadata: {
        canChat: true,
        hasApiKey: Boolean(localApiKey),
        model: localSettings.model
      }
    }]);

    // Subscribe to node events
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'request'],
      (message) => {
        console.log('Node event received:', message); // Debug log
        switch (message.eventType) {
          case 'connect':
            if (message.metadata?.target === id) {
              console.log('Node connected:', message.senderId, message.metadata); // Debug log
    setConnectedNodes(prev => {
      const updated = new Map(prev);
                const nodeType = message.metadata.type;
                const capabilities = nodeCapabilityService.getCapabilities(message.senderId) || [];
                console.log('Node capabilities:', capabilities); // Debug log
                updated.set(message.senderId, {
                  type: nodeType,
                  capabilities: capabilities
                });
      return updated;
    });
            }
            break;
          case 'disconnect':
            if (message.metadata?.target === id) {
              console.log('Node disconnected:', message.senderId); // Debug log
      setConnectedNodes(prev => {
        const updated = new Map(prev);
                updated.delete(message.senderId);
        return updated;
      });
            }
            break;
        }
      }
    );

    return () => {
      unsubscribe();
      nodeCapabilityService.unregisterNode(id);
    };
  }, [id, localApiKey, localSettings.model]);

  const handleCheckStatus = useCallback(() => {
    const connectedNodesList = Array.from(connectedNodes.entries());
    const statusMessage = {
      role: 'system',
      content: `System Status:\n${connectedNodesList.length} node(s) connected\n\nConnected Nodes:\n${connectedNodesList
        .map(([nodeId, data]) => {
          const capabilities = data.capabilities || [];
          const nodeType = data.type || 'Unknown';
          const extraInfo = capabilities.length > 0 
            ? `\n    Capabilities: ${capabilities.map(cap => cap.type).join(', ')}`
            : '';
          return `- ${nodeType} (${nodeId})${extraInfo}`;
        })
        .join('\n')}`
    };
    
    setMessages(prev => [...prev, statusMessage]);
    updateNode(id, {
      ...safeData,
      messages: [...messages, statusMessage]
    });
  }, [connectedNodes, id, messages, safeData, updateNode]);

  const handleDisconnectAll = useCallback(() => {
    Array.from(connectedNodes.keys()).forEach(nodeId => {
      messageBus.emit('disconnect', {
        senderId: id,
        receiverId: nodeId,
        metadata: {
          target: nodeId
        }
      });
    });
    setConnectedNodes(new Map());
  }, [connectedNodes, id]);

  const handleTakeNote = (noteContent: string) => {
    console.log('Taking note from message:', noteContent);
    
    // Check if we have connected notes nodes
    if (connectedNoteIds.length === 0 && !hasNotesNode) {
      console.warn('No notes nodes connected! Cannot send note.');
      setValidationMessage({
        type: 'warning',
        message: 'No notes nodes connected! Create a Notes node and connect it first.',
        timeout: 5000
      });
      return;
    }
    
    // Format note with metadata matching NotesNode expectations
    const noteId = `note-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Send note to all connected notes nodes
    connectedNoteIds.forEach(noteNodeId => {
      console.log('Attempting to send note to node:', noteNodeId);
      
      // IMPORTANT: This matches EXACTLY what the NotesNode expects in handleNoteRequest
      messageBus.emit('request', {
        eventType: 'request',
          senderId: id,
        receiverId: noteNodeId,
        type: 'request',
        content: noteContent, // Direct string content
          metadata: {
          type: 'addNote', // This is the critical field NotesNode checks for
          noteId: noteId,
          source: id,
          timestamp: timestamp,
          author: 'AI Assistant',
          source_type: autoTakeNotes ? 'auto' : 'manual'
        }
      });

      console.log('Sent note to node:', noteNodeId, 'Content:', noteContent);
      
      // Also broadcast to window for backup channel
      window.postMessage({
        type: 'node_message',
        eventType: 'request',
        action: 'addNote',
        senderId: id,
        receiverId: noteNodeId,
        targetId: noteNodeId,
        content: noteContent,
        metadata: {
          type: 'addNote',
          noteId: noteId,
          source: id, 
          timestamp: timestamp,
          author: 'AI Assistant',
          source_type: autoTakeNotes ? 'auto' : 'manual'
        }
      }, '*');
    });
    
    // Store locally for backup
    const formattedNote = {
      id: noteId,
      content: noteContent,
      timestamp: timestamp,
      source: autoTakeNotes ? 'auto' : 'manual',
      author: 'AI Assistant'
    };
    
    setTakenNotes(prev => [...prev, formattedNote]);
    
    // Save to localStorage as backup
    try {
      const existingNotes = JSON.parse(localStorage.getItem(`takenNotes-${id}`) || '[]');
      localStorage.setItem(`takenNotes-${id}`, JSON.stringify([...existingNotes, formattedNote]));
    } catch (error) {
      console.error('Error saving note to localStorage:', error);
    }
    
    // Show success feedback
    setValidationMessage({
      type: 'success',
      message: 'Note sent to Notes node',
      timeout: 3000
    });
  };

  // Add auto-note taking effect
  useEffect(() => {
    // Skip if auto-note taking is disabled
    if (!autoTakeNotes) {
      console.log('ChatNode: Auto-note taking is disabled');
      return;
    }
    
    // Skip if no messages or no notes node connected
    if (!messages.length) {
      console.log('ChatNode: No messages to take notes from');
      return;
    }
    
    // Check if we have a connected notes node
    if (connectedNoteIds.length === 0 && !hasNotesNode) {
      console.log('ChatNode: No notes nodes connected for auto-note taking');
        setValidationMessage({
        type: 'warning',
        message: 'Auto-note taking enabled but no notes nodes connected. Create a Notes node and connect it.',
        timeout: 5000
      });
      return;
    }
    
    console.log('ChatNode: Checking for new messages to auto-take notes');
    
    // Find the most recent assistant message that we haven't taken a note for
    const lastAssistantMsg = [...messages].reverse().find(msg => 
      msg.role === 'assistant' && 
      !msg.noteTaken
    );
    
    if (lastAssistantMsg) {
      console.log('ChatNode: Found assistant message to take note from:', lastAssistantMsg.id);
      
      // Mark this message as having had a note taken
      const updatedMessages = messages.map(msg => 
        msg.id === lastAssistantMsg.id 
          ? { ...msg, noteTaken: true } 
          : msg
      );
      
      // Update messages in state
      setMessages(updatedMessages);
      
      // Also update node data for persistence
      const updatedData = {
        ...safeData,
        messages: updatedMessages
      };
      updateNode(id, updatedData);
      
      // Take the note with special formatting for auto-notes
      const noteContent = `[Auto-Note ${new Date().toLocaleString()}]\n\n${lastAssistantMsg.content.substring(0, 2000)}`; // Limit length for safety
      handleTakeNote(noteContent);
      
      console.log('ChatNode: Auto-note taken successfully');
    } else {
      console.log('ChatNode: No new assistant messages to take notes from');
    }
  }, [autoTakeNotes, messages, hasNotesNode, connectedNoteIds]);

  // Initialize state from data
  useEffect(() => {
    if (safeData.settings.apiKey) {
      setLocalApiKey(safeData.settings.apiKey);
    }
    if (safeData.settings.model) {
      setLocalSettings(prev => ({
        ...prev,
        model: safeData.settings.model
      }));
    }
    if (safeData.messages) {
      setConnectedNodes(prev => {
        const updated = new Map(prev);
        safeData.messages.forEach((message, index) => {
          updated.set(index.toString(), {
            role: message.role,
            content: message.content,
            id: index.toString(),
            metadata: {
              nodeType: 'chatNode'
            }
          });
        });
        return updated;
      });
    }
  }, [safeData]);

  // Effect to detect notes nodes
  useEffect(() => {
    const edges = reactFlow.getEdges();
    const connectedEdges = edges.filter(edge => edge.source === id || edge.target === id);
    
      // Find connected notes nodes
    const notesNodeIds = connectedEdges.map(edge => {
      const otherId = edge.source === id ? edge.target : edge.source;
      const otherNode = reactFlow.getNode(otherId);
      
      if (otherNode && (
        otherNode.type === 'notes' || 
        otherNode.type === 'notesNode' || 
        otherNode.data?.type === 'notes'
      )) {
        return otherId;
      }
      return null;
    }).filter(Boolean);

    // Update state if we found any notes nodes
    if (notesNodeIds.length > 0) {
      console.log('Found connected notes nodes:', notesNodeIds);
      setHasNotesNode(true);
      setConnectedNoteIds(notesNodeIds);
    } else {
      setHasNotesNode(false);
      setConnectedNoteIds([]);
    }
  }, [id, reactFlow]);

  // Handle node connections using NodeCommunicationService
  useEffect(() => {
    const handleNodeEvent = (event) => {
      // Handle connect events
      if (event.type === 'connect') {
        if (event.receiverId === id || event.senderId === id) {
          const otherId = event.receiverId === id ? event.senderId : event.receiverId;
          const otherNode = reactFlow.getNode(otherId);
          
          if (otherNode && (
            otherNode.type === 'notes' || 
            otherNode.type === 'notesNode' || 
            otherNode.data?.type === 'notes'
          )) {
            console.log('Connected to notes node:', otherId);
            setHasNotesNode(true);
            setConnectedNoteIds(prev => [...new Set([...prev, otherId])]);
          }
        }
      }
      
      // Handle disconnect events
      if (event.type === 'disconnect') {
        if (event.receiverId === id || event.senderId === id) {
          const otherId = event.receiverId === id ? event.senderId : event.receiverId;
          
          setConnectedNoteIds(prev => {
            const updated = prev.filter(id => id !== otherId);
            setHasNotesNode(updated.length > 0);
            return updated;
          });
        }
      }
    };

    // Subscribe to node events using the correct method
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect'],
      handleNodeEvent
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [id, reactFlow, nodeCommunicationService]);

  const toggleAutoTakeNotes = useCallback(() => {
    const newAutoTakeNotes = !autoTakeNotes;
    setAutoTakeNotes(newAutoTakeNotes);
    
    // Persist the auto-take-notes setting
      updateNode(id, {
        ...safeData,
      autoTakeNotes: newAutoTakeNotes
    });
    
    // Show feedback
    setValidationMessage({
      type: 'success',
      message: `Auto note-taking ${newAutoTakeNotes ? 'enabled' : 'disabled'}`,
      timeout: 3000
    });
    
    console.log('Auto note-taking toggled:', newAutoTakeNotes);
  }, [autoTakeNotes, id, safeData, updateNode]);

  // Add effect to restore auto-take-notes state
  useEffect(() => {
    if (safeData.autoTakeNotes !== undefined && safeData.autoTakeNotes !== autoTakeNotes) {
      console.log('Restoring auto-take-notes state:', safeData.autoTakeNotes);
      setAutoTakeNotes(safeData.autoTakeNotes);
    }
  }, [safeData.autoTakeNotes]);

  // Add a handler to receive notes from NotesNode as context
  useEffect(() => {
    console.log('ChatNode: Setting up handler for notes added as context');
    
    const handleNoteContext = (message) => {
      console.log('ChatNode: Received note as context:', message);
      
      if (message.type !== 'context' || message.metadata?.type !== 'note_context') {
        return;
      }
      
      // Add the note content to the context messages
      const noteContent = message.content;
      if (!noteContent) {
        console.warn('ChatNode: Received empty note content');
        return;
      }
      
      const noteId = message.metadata.noteId;
      const action = message.metadata.action || 'add'; // Default to add if not specified
      
      if (action === 'add') {
        // Add to context
        // Add a special message to let the user know a note was added
        const contextNotification = {
          id: `ctx-${Date.now()}`,
          role: 'system',
          content: `--- Note added to conversation context ---\n${noteContent}\n---`,
          timestamp: new Date().toISOString(),
          isContextOnly: true,
          noteId: noteId // Track which note this is from
        };
        
        // Add it to messages so user sees it was added
        setMessages(prev => [...prev, contextNotification]);
        
        // Also add it to context messages for AI
        setContextMessages(prev => [...prev, {
          role: 'system',
          content: noteContent,
          noteId: noteId // Store the note ID to be able to remove it later
        }]);
        
        console.log('ChatNode: Added note to conversation context');
        
        // Show feedback
        setValidationMessage({
          type: 'success',
          message: 'Note added to conversation context',
          timeout: 3000
        });
      } else if (action === 'remove') {
        // Remove from context
        
        // Filter out the notification message for this note
        setMessages(prev => prev.filter(msg => 
          !(msg.isContextOnly && msg.noteId === noteId)
        ));
        
        // Filter out the context message for this note
        setContextMessages(prev => prev.filter(msg => msg.noteId !== noteId));
        
        console.log('ChatNode: Removed note from conversation context');
        
        // Show feedback
        setValidationMessage({
          type: 'info',
          message: 'Note removed from conversation context',
          timeout: 3000
        });
        
        // Add a removal notification
        const removalNotification = {
          id: `ctx-remove-${Date.now()}`,
          role: 'system',
          content: `--- Note removed from conversation context ---`,
          timestamp: new Date().toISOString(),
          isContextOnly: true,
          temporary: true
        };
        
        // Show temporary removal notification
        setMessages(prev => [...prev, removalNotification]);
        
        // Remove the notification after a few seconds
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => msg.id !== removalNotification.id));
        }, 3000);
      }
    };
    
    // Subscribe to send_to_ai events
    const unsubscribeSendToAI = messageBus.subscribe('send_to_ai', handleNoteContext);
    
    return () => {
      unsubscribeSendToAI();
    };
  }, []);

  return (
    <ChatNodeErrorBoundary>
      <BaseNode id={id} data={safeData} selected={selected}>
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Settings">
              <IconButton
                size="small"
                  onClick={handleSettingsOpen}
                  color={validationMessage ? (validationMessage.type === 'error' ? 'error' : 'primary') : 'primary'}
                >
                  <SettingsIcon fontSize="small" />
              </IconButton>
              </Tooltip>
              
              <Tooltip title={connectedNodes.size === 0 ? "No nodes connected" : "Check System Status"}>
                <span>
                <IconButton
                  size="small"
                    onClick={handleCheckStatus}
                    disabled={connectedNodes.size === 0}
                  >
                    <HubIcon fontSize="small" />
                </IconButton>
                </span>
              </Tooltip>
              
              <Tooltip title="Disconnect All Nodes">
                <span>
              <IconButton
                size="small"
                    onClick={handleDisconnectAll}
                    disabled={connectedNodes.size === 0}
                    color="error"
                  >
                    <LinkOffIcon fontSize="small" />
              </IconButton>
                </span>
              </Tooltip>
              
              <Tooltip title="Reset Chat">
                <span>
              <IconButton
                size="small"
                    onClick={handleResetChat}
                    disabled={messages.length === 0}
              >
                    <RestartIcon fontSize="small" />
              </IconButton>
                </span>
              </Tooltip>

              {/* Auto Notes Button */}
              {(hasNotesNode || connectedNoteIds.length > 0) && (
                <Tooltip title={autoTakeNotes ? "Disable Auto Note Taking" : "Enable Auto Note Taking"}>
              <IconButton
                size="small"
                    onClick={toggleAutoTakeNotes}
                    color={autoTakeNotes ? "secondary" : "default"}
                  >
                    <AutoNoteIcon fontSize="small" />
              </IconButton>
                </Tooltip>
            )}
          </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {hasConnectedUrlNode && (
                <Tooltip title="URL Processing Enabled">
                  <LanguageIcon fontSize="small" color="primary" />
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Messages List */}
          <Paper
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: 'background.default',
              borderRadius: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              {messages.map((message, index) => (
                <Paper
                  key={message.id || index}
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: message.role === 'user' ? 'grey.100' : 'rgba(240, 247, 255, 0.8)',
                    border: '1px solid',
                    borderColor: message.role === 'user' ? 'grey.300' : 'rgba(187, 222, 251, 0.5)',
                    borderRadius: 2,
                    position: 'relative',
                    // Special styling for context notifications
                    ...(message.isContextOnly && {
                      bgcolor: 'rgba(232, 245, 255, 0.7)',
                      borderColor: 'rgba(144, 202, 249, 0.5)',
                      borderStyle: 'dashed',
                      py: 1,
                      px: 2,
                      color: 'primary.dark',
                      fontSize: '0.9rem',
                    }),
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {!message.isContextOnly ? (
                      // Regular message content
                      <>
                  <Typography
                          variant="body2"
                        sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          pr: 4,
                          color: message.role === 'user' ? 'text.primary' : 'text.primary',
                          fontWeight: message.role === 'user' ? 'medium' : 'normal',
                        }}
                        >
                          {message.content}
                        </Typography>
                        <Box 
                          className="message-actions"
                          sx={{ 
                            opacity: { xs: 1, sm: 0.3 },  // Always visible on mobile, slightly visible on desktop
                            transition: 'opacity 0.2s',
                            ml: 1,
                            display: 'flex',
                            gap: 0.5,
                            '&:hover': {
                              opacity: 1
                            }
                          }}
                        >
                          <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(message.content);
                              }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                          </Tooltip>
                          {(hasNotesNode || connectedNoteIds.length > 0) && (
                            <Tooltip title="Take note">
                              <IconButton
                                size="small"
                                onClick={() => handleTakeNote(message.content)}
                              >
                                <NoteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                    )}
                  </Box>
                      </>
                    ) : (
                      // Context notification message (no actions)
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          width: '100%',
                          fontStyle: 'italic',
                          fontSize: '0.85rem',
                        }}
                      >
                        {message.content}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              ))}
              <div ref={messagesEndRef} />
            </Box>
          </Paper>

          {/* Input Area */}
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={localApiKey ? "Type a message..." : "Please configure API key in settings..."}
              multiline
              maxRows={4}
              disabled={!localApiKey || isProcessing}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: 'background.paper',
                }
              }}
            />
            <Tooltip title={!localApiKey ? "Configure API key in settings" : !input.trim() ? "Type a message" : ""}>
              <span>
                <Button
                  variant="contained"
              onClick={handleSendMessage}
                  disabled={!localApiKey || !input.trim() || isProcessing}
                  endIcon={<SendIcon />}
                >
                  Send
                </Button>
              </span>
            </Tooltip>
        </Box>

          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onClose={handleSettingsClose}>
            <DialogTitle>Chat Settings</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <TextField
          fullWidth
                  label="API Key"
                  type="password"
                  value={localApiKey}
                  onChange={(e) => {
                    setLocalApiKey(e.target.value);
                    setValidationMessage(null);
                  }}
                  error={validationMessage?.type === 'error'}
                  helperText={validationMessage?.message}
                  sx={{ mb: 2 }}
                />
              <FormControl fullWidth>
                <Button
                  variant="outlined"
                  onClick={() => setModelSelectOpen(true)}
                  sx={{ height: '56px', justifyContent: 'space-between', px: 2 }}
                  endIcon={<SettingsIcon />}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Current Model
                    </Typography>
                    <Typography variant="body1">
                        {MODEL_OPTIONS.find(p => p.provider === localSettings.provider)?.label} - {localSettings.model}
                    </Typography>
                  </Box>
                </Button>
              </FormControl>

              <Box>
                <Typography gutterBottom>Temperature: {localSettings.temperature}</Typography>
                <Slider
                  value={localSettings.temperature}
                  onChange={(_, value) => setLocalSettings({ ...localSettings, temperature: value as number })}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </Box>

              <TextField
                fullWidth
                type="number"
                label="Max Tokens"
                value={localSettings.maxTokens}
                onChange={(e) => setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) })}
                InputProps={{
                    inputProps: { min: 1, max: 4096 }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="System Prompt"
                  value={localSettings.systemPrompt}
                  onChange={(e) => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
                  placeholder="Enter a system prompt..."
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Environment Prompt"
                  value={localSettings.environmentPrompt}
                  onChange={(e) => setLocalSettings({ ...localSettings, environmentPrompt: e.target.value })}
                  placeholder="Enter environment context..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
              <Button onClick={handleSettingsClose}>Cancel</Button>
            <Button 
                onClick={handleSaveSettings}
              variant="contained" 
              disabled={isValidatingKey || !localApiKey.trim()}
            >
              {isValidatingKey ? 'Validating...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

          {/* Model Selection Dialog */}
        <Dialog
          open={modelSelectOpen}
          onClose={() => setModelSelectOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Select Model</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {MODEL_OPTIONS.map((provider) => (
                <Paper
                  key={provider.provider}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    {provider.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {provider.models.map((model) => (
                      <Button
                        key={model.value}
                        variant={
                          localSettings.provider === provider.provider &&
                          localSettings.model === model.value
                            ? 'contained'
                            : 'outlined'
                        }
                        onClick={() => {
                            setLocalSettings({
                            ...localSettings,
                              provider: provider.provider,
                              model: model.value,
                            });
                          setModelSelectOpen(false);
                        }}
                        sx={{ justifyContent: 'flex-start', py: 1 }}
                      >
                        {model.label}
                      </Button>
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModelSelectOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        </Box>
      </BaseNode>
    </ChatNodeErrorBoundary>
  );
}; 