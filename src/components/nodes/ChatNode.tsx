import React, { useState, useCallback, useEffect, useRef, Component } from 'react';
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
} from '@mui/material';
import { Send as SendIcon, Settings as SettingsIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { ChatNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { messageBus } from '../../services/MessageBus';

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
  { value: 'deepseek' as Provider, label: 'DeepSeek', apiUrl: 'https://github.com/settings/tokens' }
] as const;

const DEFAULT_ENVIRONMENT_PROMPT = `You are an AI assistant in a sandbox environment with the following capabilities:

1. You can interact with connected nodes through events and actions
2. You can request information from connected nodes
3. You can process and respond to events from other nodes
4. You can maintain context from connected nodes

Available node types and their capabilities:

- Notes: Can store and provide text content
- Image: Can provide image descriptions and captions
- Document: Can provide document content and metadata
- URL: Can provide web content and metadata
- ImageGeneration: Can generate images based on prompts

When interacting with nodes:
1. You can reference content from any connected node
2. You can request updates or actions from connected nodes
3. You can maintain context across multiple interactions
4. You should acknowledge and use information from connected nodes in your responses`;

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

export const ChatNode: React.FC<NodeProps<ChatNodeData>> = ({ id, data = {}, selected }) => {
  // Ensure data has default values
  const safeData = {
    messages: [],
    settings: {
      provider: 'cohere' as Provider,
      model: 'command',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "You are an AI assistant that helps users with their tasks.",
      environmentPrompt: DEFAULT_ENVIRONMENT_PROMPT,
      apiKey: ''
    },
    ...data
  };

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(safeData.settings);
  const [localApiKey, setLocalApiKey] = useState(safeData.settings.apiKey || '');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { updateNode } = useCanvasStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();
  const { getEdges, getNode } = reactFlow;
  const [notesContext, setNotesContext] = useState<string | null>(null);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);

  // Define getEnvironmentContext first
  const getEnvironmentContext = useCallback(() => {
    const edges = getEdges();
    const connectedNodes = edges
      .filter(edge => edge.target === id)
      .map(edge => getNode(edge.source))
      .filter(Boolean);

    const context = [
      localSettings.environmentPrompt || DEFAULT_ENVIRONMENT_PROMPT,
      "\nCurrent Environment Status:",
      `Connected Nodes: ${connectedNodes.length}`,
    ];

    // Add information about each connected node
    connectedNodes.forEach(node => {
      switch (node?.type) {
        case 'notesNode':
          context.push(`\nNotes Node "${node.data.label}":`);
          context.push(`Content: ${(node.data as NotesNodeData).content || 'Empty'}`);
          break;
        case 'imageNode':
          context.push(`\nImage Node "${node.data.label}":`);
          context.push(`Caption: ${(node.data as ImageNodeData).caption || 'No caption'}`);
          break;
        case 'documentNode':
          context.push(`\nDocument Node "${node.data.label}":`);
          context.push(`Title: ${(node.data as DocumentNodeData).title || 'Untitled'}`);
          break;
        case 'urlNode':
          context.push(`\nURL Node "${node.data.label}":`);
          context.push(`URL: ${(node.data as UrlNodeData).url || 'No URL'}`);
          context.push(`Description: ${(node.data as UrlNodeData).description || 'No description'}`);
          break;
      }
    });

    return context.join('\n');
  }, [id, getEdges, getNode, localSettings.environmentPrompt]);

  // Get available models based on selected provider
  const getAvailableModels = useCallback(() => {
    switch (localSettings.provider) {
      case 'cohere':
        return COHERE_MODELS;
      case 'deepseek':
        return DEEPSEEK_MODELS;
      default:
        return [];
    }
  }, [localSettings.provider]);

  // Update model when provider changes
  useEffect(() => {
    const availableModels = getAvailableModels();
    if (!availableModels.includes(localSettings.model)) {
      setLocalSettings(prev => ({
        ...prev,
        model: availableModels[0]
      }));
    }
  }, [localSettings.provider, getAvailableModels]);

  // Update local settings when data changes
  useEffect(() => {
    if (safeData.settings) {
      setLocalSettings(safeData.settings);
      setLocalApiKey(safeData.settings.apiKey || '');
    }
  }, [safeData.settings]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [safeData.messages, scrollToBottom]);

  // Function to get connected notes content
  const updateNotesContext = useCallback(() => {
    const edges = getEdges();
    const connectedNotes = edges
      .filter(edge => edge.target === id)
      .map(edge => getNode(edge.source))
      .filter(node => node?.type === 'notesNode');

    if (connectedNotes.length > 0) {
      const notesContent = connectedNotes
        .map(node => (node.data as NotesNodeData).content)
        .filter(Boolean)
        .join('\n\n');
      
      setNotesContext(notesContent || null);
    } else {
      setNotesContext(null);
    }
  }, [id, getEdges, getNode]);

  // Update notes context when edges change
  useEffect(() => {
    updateNotesContext();
  }, [updateNotesContext]);

  // Update notes context when connected notes content changes
  useEffect(() => {
    const edges = getEdges();
    const connectedNotes = edges
      .filter(edge => edge.target === id)
      .map(edge => getNode(edge.source))
      .filter(node => node?.type === 'notesNode');

    const handleNotesUpdate = (event: CustomEvent) => {
      if (connectedNotes.some(node => node.id === event.detail.nodeId)) {
        updateNotesContext();
      }
    };

    window.addEventListener('notesUpdate', handleNotesUpdate as EventListener);
    return () => {
      window.removeEventListener('notesUpdate', handleNotesUpdate as EventListener);
    };
  }, [id, getEdges, getNode, updateNotesContext]);

  // Function to get connected nodes information
  const getConnectedNodesInfo = useCallback(() => {
    const edges = getEdges();
    const connectedNodes = edges
      .filter(edge => edge.target === id)
      .map(edge => getNode(edge.source))
      .filter(Boolean);

    return connectedNodes.map(node => {
      switch (node?.type) {
        case 'notesNode':
          return {
            type: 'notes',
            content: (node.data as NotesNodeData).content
          };
        case 'imageNode':
          return {
            type: 'image',
            caption: (node.data as ImageNodeData).caption
          };
        case 'documentNode':
          return {
            type: 'document',
            title: (node.data as DocumentNodeData).title
          };
        case 'urlNode':
          return {
            type: 'url',
            title: (node.data as UrlNodeData).title,
            description: (node.data as UrlNodeData).description
          };
        default:
          return null;
      }
    }).filter(Boolean);
  }, [id, getEdges, getNode]);

  // Function to handle node events
  const handleNodeEvent = useCallback((event: NodeEvent) => {
    if (event.target === id) {
      switch (event.type) {
        case 'update':
          // Handle content updates from connected nodes
          updateNotesContext();
          break;
        case 'request':
          // Handle requests from other nodes
          if (event.payload.type === 'content') {
            // Respond with chat history or context
            messageBus.emit({
              type: 'response',
              source: id,
              target: event.source,
              payload: {
                type: 'content',
                content: safeData.messages || []
              },
              timestamp: Date.now()
            });
          }
          break;
      }
    }
  }, [id, safeData, updateNotesContext]);

  // Listen for node events
  useEffect(() => {
    const handleEvent = (e: CustomEvent) => handleNodeEvent(e.detail);
    window.addEventListener('nodeEvent', handleEvent);
    return () => window.removeEventListener('nodeEvent', handleEvent);
  }, [handleNodeEvent]);

  // Listen for edge changes using useEffect
  useEffect(() => {
    const handleEdgeChanges = () => {
      // Update environment context when edges change
      const context = getEnvironmentContext();
      console.log('Edges changed, updating context:', context);
      
      // Emit an event to notify that the chat node's context has changed
      const nodeEvent: NodeEvent = {
        type: 'update',
        source: id,
        target: 'all',
        payload: {
          type: 'contextUpdate',
          content: context
        },
        timestamp: Date.now()
      };
      
      window.dispatchEvent(new CustomEvent('nodeEvent', { detail: nodeEvent }));
    };

    // Add event listeners for edge changes
    window.addEventListener('connect', handleEdgeChanges);
    window.addEventListener('edge.added', handleEdgeChanges);
    window.addEventListener('edge.removed', handleEdgeChanges);

    return () => {
      window.removeEventListener('connect', handleEdgeChanges);
      window.removeEventListener('edge.added', handleEdgeChanges);
      window.removeEventListener('edge.removed', handleEdgeChanges);
    };
  }, [id, getEnvironmentContext]);

  const handleSettingsOpen = () => setSettingsOpen(true);
  const handleSettingsClose = () => {
    // Reset local settings to current data on cancel
    setLocalSettings(safeData.settings || {
      provider: 'cohere' as Provider,
      model: 'command',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "You are an AI assistant that helps users with their tasks.",
      environmentPrompt: DEFAULT_ENVIRONMENT_PROMPT
    });
    setLocalApiKey(safeData.settings?.apiKey || '');
    setValidationMessage(null);
    setSettingsOpen(false);
  };

  const handleSettingsSave = useCallback(async () => {
    setIsValidatingKey(true);
    setValidationMessage(null);

    try {
      let isValid = false;

      // Validate API key based on provider
      if (localSettings.provider === 'cohere') {
        const response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            message: 'test',
            model: localSettings.model,
            chat_history: [],
            stream: false,
          }),
        });

        isValid = response.ok;
      } else if (localSettings.provider === 'deepseek') {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${localApiKey}`,
            'Accept': 'application/json'
          }
        });

        isValid = response.ok;
      }

      if (isValid) {
        // Update node with new settings
        const newSettings = {
          ...localSettings,
          apiKey: localApiKey,
        };
        
        updateNode(id, {
          ...safeData,
          settings: newSettings
        });

        // Update local state
        setLocalSettings(newSettings);
        setValidationMessage({
          type: 'success',
          message: 'Settings saved successfully'
        });
        
        // Close dialog
        setSettingsOpen(false);
      } else {
        throw new Error('Failed to validate API key');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setValidationMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save settings'
      });
    } finally {
      setIsValidatingKey(false);
    }
  }, [id, safeData, localSettings, localApiKey, updateNode]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !safeData.settings?.apiKey) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: input.trim(),
      timestamp: Date.now(),
    };

    // Add user message to chat immediately
    const updatedMessages = [...(safeData.messages || []), userMessage];
    updateNode(id, {
      ...safeData,
      messages: updatedMessages,
    });

    setInput('');

    try {
      let responseText;
      
      if (safeData.settings.provider === 'cohere') {
        // Prepare system message with enhanced context
        const systemContext = [
          safeData.settings.systemPrompt || localSettings.systemPrompt,
          "",
          getEnvironmentContext()
        ].join('\n');

        // Prepare chat history
        const chatHistory = [
          {
            role: 'System',
            message: systemContext
          },
          ...updatedMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'User' : 'Chatbot',
            message: msg.content
          }))
        ];

        // Call Cohere API
        const response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${safeData.settings.apiKey}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            message: userMessage.content,
            model: safeData.settings.model,
            temperature: safeData.settings.temperature,
            max_tokens: safeData.settings.maxTokens,
            chat_history: chatHistory,
            stream: false
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const result = await response.json();
        responseText = result.text || (result.message && result.message.text);

        if (!responseText) {
          throw new Error('No response text found in API response');
        }
      } else if (safeData.settings.provider === 'deepseek') {
        // Prepare system message with enhanced context
        const systemContext = [
          safeData.settings.systemPrompt || localSettings.systemPrompt,
          "",
          getEnvironmentContext()
        ].join('\n');

        // Call DeepSeek API
        const response = await fetch('https://api.github.com/models/azureml-deepseek/DeepSeek-R1/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${safeData.settings.apiKey}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: safeData.settings.model,
            messages: [
              { role: 'system', content: systemContext },
              ...updatedMessages.map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            ],
            temperature: safeData.settings.temperature,
            max_tokens: safeData.settings.maxTokens
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const result = await response.json();
        responseText = result.choices[0]?.message?.content;

        if (!responseText) {
          throw new Error('No response text found in API response');
        }
      }

      // Create assistant message
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: responseText,
        timestamp: Date.now(),
      };

      // Update chat with assistant's response
      const newMessages = [...updatedMessages, assistantMessage];
      updateNode(id, {
        ...safeData,
        messages: newMessages,
      });

      // After getting the response, notify connected nodes
      const nodeEvent: NodeEvent = {
        type: 'update',
        source: id,
        target: 'all',
        payload: {
          type: 'message',
          content: responseText
        },
        timestamp: Date.now()
      };

      // Emit the event
      const event = new CustomEvent('nodeEvent', { detail: nodeEvent });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error:', error);
      setValidationMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send message'
      });
    }
  }, [id, safeData, input, updateNode, getEnvironmentContext, localSettings.systemPrompt]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  return (
    <ChatNodeErrorBoundary>
      <BaseNode id={id} data={safeData} selected={selected}>
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
              justifyContent: 'flex-end',
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <IconButton size="small" onClick={handleSettingsOpen}>
              <SettingsIcon />
            </IconButton>
          </Box>

          <Paper
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: 'background.default',
              borderRadius: 0,
            }}
          >
            <List>
              {safeData.messages?.map((message, index) => (
                <ListItem
                  key={index}
                  sx={{
                    flexDirection: 'column',
                    alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    {message.role}
                  </Typography>
                  <Paper
                    sx={{
                      p: 1,
                      bgcolor:
                        message.role === 'user'
                          ? 'primary.main'
                          : 'background.paper',
                      color:
                        message.role === 'user' ? 'primary.contrastText' : 'inherit',
                      maxWidth: '80%',
                    }}
                  >
                    <ListItemText
                      primary={message.content}
                      sx={{ m: 0 }}
                    />
                  </Paper>
                </ListItem>
              ))}
              <div ref={messagesEndRef} />
            </List>
          </Paper>

          <Box
            sx={{
              display: 'flex',
              p: 1,
              gap: 1,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <TextField
              fullWidth
              size="small"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={safeData.settings?.apiKey ? "Type a message..." : "Please configure API key in settings..."}
              multiline
              maxRows={4}
              disabled={!safeData.settings?.apiKey}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!input.trim() || !safeData.settings?.apiKey}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>

        <Dialog 
          open={settingsOpen} 
          onClose={handleSettingsClose}
          disablePortal={false}
          container={document.body}
          aria-labelledby="chat-settings-title"
          keepMounted={false}
          disableEnforceFocus
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle id="chat-settings-title">Chat Settings</DialogTitle>
          <DialogContent sx={{ minHeight: '400px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: '400px' }}>
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
                      {MODEL_OPTIONS.find(p => p.provider === safeData.settings.provider)?.label} - {safeData.settings.model}
                    </Typography>
                  </Box>
                </Button>
              </FormControl>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  fullWidth
                  label={`${localSettings.provider === 'cohere' ? 'Cohere' : 'DeepSeek'} API Key`}
                  type="password"
                  value={localApiKey}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    console.log('Setting new API key length:', newValue.length);
                    setLocalApiKey(newValue);
                    setValidationMessage(null);
                  }}
                  placeholder={`Enter your ${localSettings.provider === 'cohere' ? 'Cohere' : 'GitHub'} API key`}
                  error={validationMessage?.type === 'error'}
                  disabled={isValidatingKey}
                  InputProps={{
                    endAdornment: localApiKey ? (
                      <InputAdornment position="end">
                        <Typography variant="caption" color="text.secondary">
                          {localApiKey.length} characters
                        </Typography>
                      </InputAdornment>
                    ) : null
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: '24px' }}>
                  {isValidatingKey ? (
                    <Typography variant="caption" color="text.secondary">
                      Validating API key...
                    </Typography>
                  ) : validationMessage ? (
                    <Typography 
                      variant="caption" 
                      color={validationMessage.type === 'error' ? 'error' : 'success.main'}
                    >
                      {validationMessage.message}
                    </Typography>
                  ) : (
                    <Button
                      component="a"
                      href={MODEL_OPTIONS.find(p => p.provider === localSettings.provider)?.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ p: 0, textTransform: 'none', textDecoration: 'underline' }}
                    >
                      Get your {localSettings.provider === 'cohere' ? 'Cohere' : 'GitHub'} API key here
                    </Button>
                  )}
                </Box>
              </Box>

              <Box>
                <Typography gutterBottom>Temperature: {localSettings.temperature}</Typography>
                <Slider
                  value={localSettings.temperature}
                  onChange={(_, value) => setLocalSettings({ ...localSettings, temperature: value as number })}
                  min={0}
                  max={2}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 1, label: '1' },
                    { value: 2, label: '2' },
                  ]}
                  aria-label="Temperature"
                />
              </Box>

              <TextField
                fullWidth
                type="number"
                label="Max Tokens"
                value={localSettings.maxTokens}
                onChange={(e) => setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) })}
                InputProps={{
                  inputProps: { min: 1, max: 4096 },
                  endAdornment: <InputAdornment position="end">tokens</InputAdornment>,
                }}
                aria-label="Maximum Tokens"
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="System Prompt"
                value={localSettings.systemPrompt || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  systemPrompt: e.target.value
                })}
                placeholder="Enter a system prompt to guide the AI's behavior..."
                helperText="This prompt will be included at the start of every conversation to provide context and instructions to the AI."
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Environment Prompt"
                value={localSettings.environmentPrompt || DEFAULT_ENVIRONMENT_PROMPT}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  environmentPrompt: e.target.value
                })}
                placeholder="Enter environment context for the AI..."
                helperText="This prompt helps the AI understand its environment and capabilities"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleSettingsClose} disabled={isValidatingKey} aria-label="Cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSettingsSave} 
              variant="contained" 
              disabled={isValidatingKey || !localApiKey.trim()}
              aria-label="Save Settings"
            >
              {isValidatingKey ? 'Validating...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

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
                          const newProvider = provider.provider;
                          const newModel = model.value;
                          console.log('Setting new provider and model:', newProvider, newModel);
                          
                          // Create new settings object
                          const newSettings = {
                            ...localSettings,
                            provider: newProvider,
                            model: newModel,
                          };
                          
                          // Update both local state and node state
                          setLocalSettings(newSettings);
                          updateNode(id, {
                            ...safeData,
                            settings: newSettings
                          });
                          
                          // Reset API key and validation when changing providers
                          if (newProvider !== localSettings.provider) {
                            setLocalApiKey('');
                            setValidationMessage(null);
                          }
                          
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
      </BaseNode>
    </ChatNodeErrorBoundary>
  );
}; 