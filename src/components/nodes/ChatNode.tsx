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

  // Ensure data has default values
  const safeData = useMemo(() => {
    const defaultData = {
      messages: [],
      settings: {
        provider: 'cohere' as Provider,
        model: 'command',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: "You are an AI assistant that helps users with their tasks.",
        environmentPrompt: DEFAULT_ENVIRONMENT_PROMPT,
        apiKey: ''
      }
    };

    return {
      ...defaultData,
      messages: data.messages || defaultData.messages,
      settings: {
        ...defaultData.settings,
        ...data.settings
      }
    };
  }, [data]);

  // State declarations
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(safeData.settings);
  const [localApiKey, setLocalApiKey] = useState(safeData.settings.apiKey || '');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState(safeData.messages);
  const [connectedNodes, setConnectedNodes] = useState<Map<string, any>>(new Map());

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
      
      // Prepare system context
      const systemContext = `${DEFAULT_ENVIRONMENT_PROMPT}\n\n${localSettings.systemPrompt}`;
      
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
            system: systemContext,
            preamble_override: DEFAULT_ENVIRONMENT_PROMPT // Ensure sandbox context
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
            messages: [
              { role: 'system', content: DEFAULT_ENVIRONMENT_PROMPT }, // Ensure sandbox context
              { role: 'system', content: localSettings.systemPrompt },
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
      const assistantMessage = localSettings.provider === 'cohere' 
        ? { role: 'assistant', content: result.text }
        : result.choices[0].message;

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

  const handleTakeNote = useCallback((content: string) => {
    const connectedNoteNodes = Array.from(connectedNodes.entries())
      .filter(([_, nodeData]) => 
        nodeData.type === 'notesNode' || 
        (nodeData.capabilities && nodeData.capabilities.some(cap => cap.type === 'notesNode'))
      );
    
    if (connectedNoteNodes.length > 0) {
      connectedNoteNodes.forEach(([nodeId]) => {
        nodeCommunicationService.sendEvent(id, nodeId, 'request', {
          type: 'addNote',
          content: content,
          timestamp: new Date().toISOString(),
          source: 'chat'
        });
      });
      
      // Show feedback that note was taken
      setValidationMessage({
        type: 'success',
        message: 'Note added successfully'
      });
      setTimeout(() => setValidationMessage(null), 2000);
    }
  }, [connectedNodes, id, nodeCommunicationService]);

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
              <Tooltip title={connectedNodes.size === 0 ? "No nodes connected" : "Disconnect All Nodes"}>
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
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasConnectedNotesNode && (
                <Tooltip title="Note Taking Enabled">
                  <NoteIcon fontSize="small" color="primary" />
                </Tooltip>
              )}
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
                  key={index}
                  sx={{
                    p: 1,
                    mb: 1,
                    bgcolor: message.role === 'user' ? 'primary.light' : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    position: 'relative',
                    '&:hover .message-actions': {
                      opacity: 1,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        pr: 4,
                      }}
                    >
                      {message.content}
                    </Typography>
                    <Box 
                      className="message-actions"
                      sx={{ 
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        ml: 1,
                        display: 'flex',
                        gap: 0.5
                      }}
                    >
                      <Tooltip title="Copy message">
                        <IconButton
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                          }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {hasConnectedNotesNode && (
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