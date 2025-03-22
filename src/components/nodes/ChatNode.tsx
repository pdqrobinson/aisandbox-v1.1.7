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

const MODEL_OPTIONS = [
  {
    provider: 'cohere',
    label: 'Cohere',
    models: [
      { value: 'command', label: 'Command' },
      { value: 'command-light', label: 'Command Light' },
      { value: 'command-nightly', label: 'Command Nightly' },
      { value: 'command-light-nightly', label: 'Command Light Nightly' }
    ]
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    models: [
      { value: 'deepseek-coder-6.7b-instruct', label: 'DeepSeek Coder 6.7B' },
      { value: 'deepseek-coder-33b-instruct', label: 'DeepSeek Coder 33B' }
    ]
  }
];

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
    console.error('ChatNode error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2, bgcolor: 'error.main', color: 'white', borderRadius: 1 }}>
          <Typography variant="h6">Something went wrong</Typography>
          <Typography variant="body2">{this.state.error?.message}</Typography>
          <Button 
            variant="contained" 
            color="inherit" 
            sx={{ mt: 1, color: 'error.main' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export const ChatNode: React.FC<NodeProps<ChatNodeData>> = ({ id, data = {}, selected }) => {
  const reactFlow = useReactFlow();
  const { updateNode } = useCanvasStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Default data for the node
  const defaultData = {
    messages: [],
    settings: {
      provider: 'cohere' as Provider,
      model: 'command',
      temperature: 0.7,
      maxTokens: 800,
      apiKey: '',
      systemPrompt: 'You are a helpful AI assistant.',
      environmentPrompt: DEFAULT_ENVIRONMENT_PROMPT,
    },
    autoTakeNotes: false,
    contextNotes: []
  };
  
  // Safely merge provided data with defaults
  const safeData = {
    messages: data.messages ?? defaultData.messages,
    settings: {
      ...defaultData.settings,
      ...data.settings,
    },
    autoTakeNotes: data.autoTakeNotes ?? defaultData.autoTakeNotes,
    contextNotes: data.contextNotes ?? defaultData.contextNotes
  };
  
  // State
  const [messages, setMessages] = useState(safeData.messages);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(safeData.settings.apiKey || '');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timeout?: number;
  } | null>(null);
  const [localSettings, setLocalSettings] = useState(safeData.settings);
  const [connectedNodes, setConnectedNodes] = useState<Map<string, NodeMessage>>(new Map());
  const [hasNotesNode, setHasNotesNode] = useState(false);
  const [connectedNoteIds, setConnectedNoteIds] = useState<string[]>([]);
  const [hasConnectedUrlNode, setHasConnectedUrlNode] = useState(false);
  const [autoTakeNotes, setAutoTakeNotes] = useState(safeData.autoTakeNotes || false);
  const [contextNotes, setContextNotes] = useState<string[]>(safeData.contextNotes || []);
  
  const nodeCommunicationService = useMemo(() => NodeCommunicationService.getInstance(), []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Clear validation message after timeout
  useEffect(() => {
    if (validationMessage && validationMessage.timeout) {
      const timer = setTimeout(() => {
        setValidationMessage(null);
      }, validationMessage.timeout);
      
      return () => clearTimeout(timer);
    }
  }, [validationMessage]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    // Check if API key is set
    if (!safeData.settings.apiKey) {
      setValidationMessage({
        type: 'error',
        message: 'API key not set. Please configure in settings.',
        timeout: 5000
      });
      setSettingsOpen(true);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Add user message
      const userMessage = { role: 'user', content: inputValue };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInputValue('');
      
      // Prepare system prompt with context from connected nodes
      let systemPrompt = localSettings.systemPrompt;
      let environmentContext = localSettings.environmentPrompt;
      
      // Add context from connected nodes
      if (connectedNodes.size > 0) {
        const nodeContexts = Array.from(connectedNodes.values())
          .map(node => node.content)
          .filter(Boolean);
        
        if (nodeContexts.length > 0) {
          environmentContext += '\n\nConnected Node Content:\n' + nodeContexts.join('\n\n');
        }
      }
      
      // Add context from notes that have been marked for context
      if (contextNotes.length > 0) {
        environmentContext += '\n\nContext Notes:\n' + contextNotes.join('\n\n');
      }
      
      // Prepare conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add the new user message
      conversationHistory.push({
        role: 'user',
        content: inputValue
      });
      
      // Call AI service based on provider
      let aiResponse = '';
      
      if (localSettings.provider === 'cohere') {
        // Simulate API call for now
        console.log('Calling Cohere API with:', {
          model: localSettings.model,
          temperature: localSettings.temperature,
          maxTokens: localSettings.maxTokens,
          messages: conversationHistory,
          systemPrompt,
          environmentContext
        });
        
        // In a real implementation, this would call the actual Cohere API
        aiResponse = `This is a simulated response from the ${localSettings.model} model. In a real implementation, this would be an actual response from the Cohere API.`;
        
        // Add a small delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (localSettings.provider === 'deepseek') {
        // Simulate DeepSeek API call
        console.log('Calling DeepSeek API with:', {
          model: localSettings.model,
          temperature: localSettings.temperature,
          maxTokens: localSettings.maxTokens,
          messages: conversationHistory,
          systemPrompt,
          environmentContext
        });
        
        aiResponse = `This is a simulated response from the ${localSettings.model} model. In a real implementation, this would be an actual response from the DeepSeek API.`;
        
        // Add a small delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check if we should automatically take a note of this response
      const noteContent = aiResponse;
      if (autoTakeNotes && (hasNotesNode || connectedNoteIds.length > 0)) {
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
          timestamp,
          noteId,
          source_type: autoTakeNotes ? 'auto' : 'manual'
        }
      });
    });
    
    // Show feedback
    setValidationMessage({
      type: 'success',
      message: 'Note sent to connected notes node',
      timeout: 3000
    });
  };
  
  const handleClearMessages = () => {
    setMessages([]);
    updateNode(id, {
      ...safeData,
      messages: []
    });
  };
  
  const handleCopyMessages = () => {
    const text = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    
    setValidationMessage({
      type: 'success',
      message: 'Conversation copied to clipboard',
      timeout: 3000
    });
  };
  
  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };
  
  const handleSettingsClose = () => {
    setLocalSettings(safeData.settings);
    setLocalApiKey(safeData.settings.apiKey || '');
    setSettingsOpen(false);
  };
  
  const handleSaveSettings = () => {
    // Validate API key
    setIsValidatingKey(true);
    
    // Simulate API key validation
    setTimeout(() => {
      setIsValidatingKey(false);
      
      // Update settings
      const updatedSettings = {
        ...safeData.settings,
        ...localSettings,
        apiKey: localApiKey
      };
      
      updateNode(id, {
        ...safeData,
        settings: updatedSettings
      });
      
      setValidationMessage({
        type: 'success',
        message: 'Settings saved successfully',
        timeout: 3000
      });
      
      setSettingsOpen(false);
    }, 1000);
  };
  
  // Auto-take notes from the last assistant message
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    
    if (lastAssistantMessage && autoTakeNotes && (hasNotesNode || connectedNoteIds.length > 0)) {
      const noteContent = lastAssistantMessage.content;
      
      // Don't take notes if the content is empty
      if (!noteContent.trim()) {
        console.log('ChatNode: Empty content, not taking note');
        return;
      }
      
      handleTakeNote(noteContent);
      
      console.log('ChatNode: Auto-note taken successfully');
    } else {
      console.log('ChatNode: No new assistant messages to take notes from');
    }
  }, [autoTakeNotes, messages, hasNotesNode, connectedNoteIds]);
  
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
    
    // Notify connected notes nodes about the auto-take-notes status change
    connectedNoteIds.forEach(noteNodeId => {
      messageBus.emit('update', {
        eventType: 'update',
        senderId: id,
        receiverId: noteNodeId,
        type: 'update',
        content: `Auto note-taking ${newAutoTakeNotes ? 'enabled' : 'disabled'}`,
        metadata: {
          action: 'autoTakeNotesChanged',
          enabled: newAutoTakeNotes
        }
      });
    });
    
    console.log('Auto note-taking toggled:', newAutoTakeNotes);
  }, [autoTakeNotes, id, safeData, updateNode, connectedNoteIds]);
  
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
    
    const handleNoteContextUpdate = (message: any) => {
      if (message.metadata?.action === 'commitToContext') {
        const noteContent = message.content;
        const noteId = message.metadata.noteId;
        const inContext = message.metadata.inContext;
        
        console.log('ChatNode: Received note context update:', { noteId, inContext });
        
        if (inContext) {
          // Add to context if not already there
          setContextNotes(prev => {
            if (!prev.includes(noteContent)) {
              const updated = [...prev, noteContent];
              
              // Update node data
              updateNode(id, {
                ...safeData,
                contextNotes: updated
              });
              
              return updated;
            }
            return prev;
          });
        } else {
          // Remove from context
          setContextNotes(prev => {
            const updated = prev.filter(note => note !== noteContent);
            
            // Update node data
            updateNode(id, {
              ...safeData,
              contextNotes: updated
            });
            
            return updated;
          });
        }
        
        // Show feedback
        setValidationMessage({
          type: 'info',
          message: inContext ? 'Note added to context' : 'Note removed from context',
          timeout: 3000
        });
      }
    };
    
    // Subscribe to update events
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['update'],
      handleNoteContextUpdate
    );
    
    return () => {
      unsubscribe();
    };
  }, [id, nodeCommunicationService, safeData, updateNode]);
  
  // Set up event listeners for node connections
  useEffect(() => {
    console.log('ChatNode: Setting up event listeners');
    
    // Handler for node connections and messages
    const handleNodeEvent = (message: any) => {
      console.log('ChatNode: Received node event:', message);
      
      if (message.eventType === 'connect') {
        // Check if the connected node is a notes node
        const isNotesNode = message.metadata?.type === 'notes';
        const hasNotesCapability = message.metadata?.capabilities?.includes('canReceiveNotes');
        
        if (isNotesNode || hasNotesCapability) {
          console.log('ChatNode: Connected to notes node:', message.senderId);
          setHasNotesNode(true);
          setConnectedNoteIds(prev => [...prev, message.senderId]);
        }
        
        // Check if the connected node is a URL node
        const isUrlNode = message.metadata?.type === 'url';
        if (isUrlNode) {
          console.log('ChatNode: Connected to URL node');
          setHasConnectedUrlNode(true);
        }
        
        // Store the connected node
        setConnectedNodes(prev => {
          const updated = new Map(prev);
          updated.set(message.senderId, {
            id: message.senderId,
            content: message.content,
            metadata: message.metadata
          });
          return updated;
        });
      } else if (message.eventType === 'disconnect') {
        // Remove the disconnected node
        setConnectedNodes(prev => {
          const updated = new Map(prev);
          updated.delete(message.senderId);
          return updated;
        });
        
        // Check if it was a notes node
        setConnectedNoteIds(prev => prev.filter(id => id !== message.senderId));
        
        // Recalculate if we still have any notes nodes
        setTimeout(() => {
          const hasAnyNotesNodes = Array.from(connectedNodes.values()).some(
            node => node.metadata?.type === 'notes' || node.metadata?.capabilities?.includes('canReceiveNotes')
          );
          setHasNotesNode(hasAnyNotesNodes);
        }, 0);
        
        // Check if it was a URL node
        const isUrlNode = message.metadata?.type === 'url';
        if (isUrlNode) {
          // Recalculate if we still have any URL nodes
          setTimeout(() => {
            const hasAnyUrlNodes = Array.from(connectedNodes.values()).some(
              node => node.metadata?.type === 'url'
            );
            setHasConnectedUrlNode(hasAnyUrlNodes);
          }, 0);
        }
      } else if (message.eventType === 'update') {
        // Update the node content
        setConnectedNodes(prev => {
          const updated = new Map(prev);
          const existingNode = updated.get(message.senderId);
          
          if (existingNode) {
            updated.set(message.senderId, {
              ...existingNode,
              content: message.content,
              metadata: {
                ...existingNode.metadata,
                ...message.metadata
              }
            });
          }
          
          return updated;
        });
      }
    };
    
    // Subscribe to events
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'update'],
      handleNodeEvent
    );
    
    // Register node capabilities
    nodeCapabilityService.registerCapability(id, 'canChat');
    
    // Clean up on unmount
    return () => {
      unsubscribe();
      nodeCapabilityService.unregisterAllCapabilities(id);
    };
  }, [id, reactFlow, nodeCommunicationService]);
  
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
    if (safeData.contextNotes) {
      setContextNotes(safeData.contextNotes);
    }
  }, []);
  
  return (
    <ChatNodeErrorBoundary>
      <BaseNode selected={selected} nodeId={id}>
        <Box
          sx={{
            width: 320,
            height: 400,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'grey.900',
            borderRadius: 1,
            overflow: 'hidden',
            color: 'white',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 1,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'grey.900',
            }}
          >
            <Typography variant="subtitle2" fontWeight="medium" color="white">
              Chat
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Settings">
                <IconButton
                  size="small"
                  onClick={handleSettingsOpen}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear Messages">
                <IconButton
                  size="small"
                  onClick={handleClearMessages}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy Conversation">
                <IconButton
                  size="small"
                  onClick={handleCopyMessages}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          {/* Validation message */}
          {validationMessage && (
            <Box
              sx={{
                p: 1,
                bgcolor: validationMessage.type === 'error' ? 'error.dark' :
                  validationMessage.type === 'warning' ? 'warning.dark' :
                    validationMessage.type === 'success' ? 'success.dark' : 'info.dark',
                color: 'white',
                fontSize: '0.75rem',
              }}
            >
              {validationMessage.message}
            </Box>
          )}
          
          {/* Node connections info */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              p: 0.5,
              px: 1,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'grey.800',
              fontSize: '0.75rem',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                {localSettings.provider === 'cohere' ? 'Cohere' : 'DeepSeek'}: {localSettings.model}
              </Typography>
              {hasNotesNode && (
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
              bgcolor: 'grey.900',
              borderRadius: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              {messages.map((message, index) => (
                <Paper
                  key={message.id || index}
                  elevation={0}
                  sx={{
                    p: 1,
                    mb: 1,
                    bgcolor: message.role === 'user' ? 'grey.800' : 'primary.dark',
                    borderRadius: 1,
                    maxWidth: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: message.role === 'user' ? 'primary.light' : 'white',
                        fontWeight: 'bold',
                      }}
                    >
                      {message.role === 'user' ? 'You' : 'AI'}
                    </Typography>
                    
                    {message.role === 'assistant' && hasNotesNode && (
                      <Box>
                        <Tooltip title="Take Note">
                          <IconButton
                            size="small"
                            onClick={() => handleTakeNote(message.content)}
                            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                          >
                            <NoteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                  
                  {message.role !== 'system' ? (
                    <>
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: 'white',
                        }}
                      >
                        {message.content}
                      </Typography>
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
                        color: 'rgba(180, 220, 255, 0.9)',
                      }}
                    >
                      {message.content}
                    </Typography>
                  )}
                </Paper>
              ))}
              
              {/* Show context notes indicator if any */}
              {contextNotes.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1,
                    mb: 1,
                    bgcolor: 'info.dark',
                    borderRadius: 1,
                    maxWidth: '100%',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  >
                    Context Notes ({contextNotes.length})
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                    }}
                  >
                    {contextNotes.length === 1 
                      ? "1 note is being used as context for this conversation"
                      : `${contextNotes.length} notes are being used as context for this conversation`}
                  </Typography>
                </Paper>
              )}
              
              {isProcessing && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1,
                    mb: 1,
                    bgcolor: 'primary.dark',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'white' }}>
                    AI is thinking...
                  </Typography>
                </Paper>
              )}
              <div ref={messagesEndRef} />
            </Box>
          </Paper>
          
          {/* Input Area */}
          <Box
            sx={{
              display: 'flex',
              p: 1,
              gap: 1,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'grey.800',
            }}
          >
            <TextField
              fullWidth
              size="small"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              multiline
              maxRows={3}
              variant="outlined"
              disabled={isProcessing}
              InputProps={{
                sx: {
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                },
              }}
              sx={{
                '& .MuiInputBase-input': {
                  color: 'white',
                },
                '& .MuiFormLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
          
          {/* Settings Dialog */}
          <Dialog
            open={settingsOpen}
            onClose={handleSettingsClose}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Chat Settings</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  fullWidth
                  label="API Key"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  type="password"
                  helperText={
                    localSettings.provider === 'cohere'
                      ? 'Enter your Cohere API key'
                      : 'Enter your DeepSeek API key (GitHub token)'
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          size="small"
                          onClick={() => window.open(PROVIDERS.find(p => p.value === localSettings.provider)?.apiUrl, '_blank')}
                        >
                          Get Key
                        </Button>
                      </InputAdornment>
                    ),
                  }}
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
