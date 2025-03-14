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
} from '@mui/material';
import { Send as SendIcon, Settings as SettingsIcon, Refresh as RefreshIcon, Delete as DeleteIcon, ContentCopy as ContentCopyIcon, Recycling as RecyclingIcon } from '@mui/icons-material';
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

  // Add new state for connected nodes
  const [connectedNodes, setConnectedNodes] = useState<Map<string, any>>(new Map());
  const nodeCommunicationService = useMemo(() => NodeCommunicationService.getInstance(), []);

  // Add state for tracking context updates
  const [isUpdatingContext, setIsUpdatingContext] = useState(false);
  const contextUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for note-taking mode
  const [isNoteTakingEnabled, setIsNoteTakingEnabled] = useState(false);

  // Add this near the top of the component with other state declarations
  const hasConnectedNotesNode = useMemo(() => {
    return Array.from(connectedNodes.entries())
      .some(([_, nodeData]) => nodeData.type === 'notesNode' || nodeData.type === 'notes');
  }, [connectedNodes]);

  // Initialize node communication and capabilities
  useEffect(() => {
    try {
      // Register node capabilities
      nodeCapabilityService.registerCapabilities(id, [{
        type: 'chat',
        metadata: {
          provider: safeData.settings.provider,
          model: safeData.settings.model
        }
      }]);

      // Initialize connected nodes from existing edges
      const edges = getEdges();
      const initialConnectedNodes = new Map();
      
      try {
        edges.forEach(edge => {
          if (edge.source === id || edge.target === id) {
            const connectedId = edge.source === id ? edge.target : edge.source;
            const connectedNode = getNode(connectedId);
            if (connectedNode) {
              initialConnectedNodes.set(connectedId, {
                type: connectedNode.type,
                nodeId: connectedId,
                capabilities: nodeCapabilityService.getCapabilities(connectedId) || []
              });
            }
          }
        });
      } catch (error) {
        console.error('Error initializing connected nodes:', error);
      }

      setConnectedNodes(initialConnectedNodes);

      // Subscribe to events with error handling
      const unsubscribe = nodeCommunicationService.subscribeToEvents(
        id,
        ['message', 'update', 'connect', 'disconnect', 'context_updated'],
        (message) => {
          try {
            console.log('ChatNode received message:', message);
            
            switch (message.eventType) {
              case 'connect':
                if (message.metadata?.target === id) {
                  handleNodeConnection(message.senderId, message.metadata);
                }
                break;
              case 'disconnect':
                if (message.metadata?.target === id) {
                  handleNodeDisconnection(message.senderId);
                }
                break;
              case 'update':
                if (message.metadata?.type === 'content' && connectedNodes.has(message.senderId)) {
                  handleNodeContentUpdate(message.senderId, message.content);
                }
                break;
              case 'context_updated':
                if (!isUpdatingContext) {
                  handleContextUpdate(message);
                }
                break;
            }
          } catch (error) {
            console.error('Error handling message:', error);
          }
        }
      );

      return () => {
        try {
          unsubscribe();
          nodeCapabilityService.unregisterNode(id);
          if (contextUpdateTimeoutRef.current) {
            clearTimeout(contextUpdateTimeoutRef.current);
          }
        } catch (error) {
          console.error('Error cleaning up ChatNode:', error);
        }
      };
    } catch (error) {
      console.error('Error initializing ChatNode:', error);
    }
  }, [id, isUpdatingContext]);

  // Define updateEnvironmentContext first
  const updateEnvironmentContext = useCallback(() => {
    if (isUpdatingContext) return;

    const context = [
      localSettings.environmentPrompt || DEFAULT_ENVIRONMENT_PROMPT,
      "\nCurrent Environment Status:",
      `Connected Nodes: ${connectedNodes.size}`,
      "\nDetailed Node Information:"
    ];

    connectedNodes.forEach((nodeData, nodeId) => {
      const nodeType = nodeData.type;
      context.push(`\n## ${nodeType} Node (${nodeId})`);
      
      // Add node capabilities
      if (nodeData.capabilities?.length > 0) {
        context.push(`Capabilities: ${nodeData.capabilities.join(', ')}`);
      }

      // Add node content based on type
      if (nodeData.content) {
        switch (nodeType) {
          case 'notesNode':
            context.push('Notes Content:');
            // Handle both string content and object content
            const notesContent = typeof nodeData.content === 'string' 
              ? nodeData.content 
              : nodeData.content.text || nodeData.content;
            context.push(notesContent);
            break;
          case 'imageNode':
            context.push('Image Caption:');
            context.push(nodeData.content.caption || 'No caption available');
            if (nodeData.content.description) {
              context.push('Image Description:');
              context.push(nodeData.content.description);
            }
            break;
          case 'documentNode':
            context.push('Document Title:');
            context.push(nodeData.content.title || 'Untitled');
            if (nodeData.content.text) {
              context.push('Document Content:');
              context.push(nodeData.content.text);
            }
            break;
          case 'urlNode':
            context.push('URL Information:');
            context.push(`Title: ${nodeData.content.title || 'No title'}`);
            if (nodeData.content.description) {
              context.push(`Description: ${nodeData.content.description}`);
            }
            break;
        }
      }
      context.push(''); // Add empty line between nodes
    });

    // Add instructions for the AI about how to use connected nodes
    context.push(`\nInstructions for Using Connected Nodes:
1. You can reference content from any connected node in your responses
2. When asked about connected nodes, list them and their content
3. Use the information from connected nodes to enhance your responses
4. You can request updates from connected nodes if needed
5. Treat connected nodes' content as part of your knowledge base`);

    // Update node data with new context
    updateNode(id, {
      ...safeData,
      environmentContext: context.join('\n')
    });

    // Notify other nodes about context update
    messageBus.emit('context_updated', {
      senderId: id,
      content: context.join('\n'),
      type: 'context',
      metadata: {
        nodeId: id,
        connectedNodes: Array.from(connectedNodes.keys())
      }
    });
  }, [id, connectedNodes, localSettings.environmentPrompt, safeData, updateNode, isUpdatingContext]);

  // Then define the node connection handlers
  const handleNodeConnection = useCallback((nodeId: string, metadata: any) => {
    console.log('ChatNode: Handling node connection:', { nodeId, metadata });
    setConnectedNodes(prev => {
      const updated = new Map(prev);
      // Normalize the node type
      const nodeType = metadata.type === 'notes' ? 'notesNode' : metadata.type;
      console.log('ChatNode: Setting node type:', { nodeId, nodeType });
      updated.set(nodeId, {
        ...metadata,
        type: nodeType
      });
      return updated;
    });
    
    // Emit connection acknowledgment
    console.log('ChatNode: Emitting connection acknowledgment');
    messageBus.emit('connect', {
      senderId: id,
      receiverId: nodeId,
      content: 'Connection accepted',
      type: 'connection',
      metadata: {
        type: 'chat',
        capabilities: nodeCapabilityService.getCapabilities(id)
      }
    });

    updateEnvironmentContext();
  }, [id, nodeCapabilityService, updateEnvironmentContext]);

  const handleNodeDisconnection = useCallback((nodeId: string) => {
    setConnectedNodes(prev => {
      const updated = new Map(prev);
      updated.delete(nodeId);
      return updated;
    });
    updateEnvironmentContext();
  }, [updateEnvironmentContext]);

  // Enhance handleNodeContentUpdate to process different content types
  const handleNodeContentUpdate = useCallback((nodeId: string, content: any) => {
    setConnectedNodes(prev => {
      const updated = new Map(prev);
      const nodeData = updated.get(nodeId) || {};
      
      // Process content based on node type
      let processedContent = content;
      if (nodeData.type === 'notesNode') {
        // For notes, ensure we store the actual content
        processedContent = typeof content === 'string' ? content : content.text || content;
      } else {
        // For other types, maintain the content structure
        processedContent = typeof content === 'string' ? { text: content } : content;
      }
      
      updated.set(nodeId, { 
        ...nodeData, 
        content: processedContent,
        lastUpdated: Date.now()
      });
      return updated;
    });
    
    // Update environment context when content changes
    updateEnvironmentContext();
  }, [updateEnvironmentContext]);

  // Handle context update
  const handleContextUpdate = useCallback((message: EventMessage) => {
    if (message.metadata?.nodeId !== id) return;
    
    setIsUpdatingContext(true);
    
    // Clear any existing timeout
    if (contextUpdateTimeoutRef.current) {
      clearTimeout(contextUpdateTimeoutRef.current);
    }

    // Set a new timeout to update the context
    contextUpdateTimeoutRef.current = setTimeout(() => {
      const { connectedNodes: newConnectedNodes, connectedNodesContent } = message.metadata;
      
      // Update connected nodes map
      setConnectedNodes(prev => {
        const updated = new Map(prev);
        newConnectedNodes.forEach((nodeId: string) => {
          const nodeContent = connectedNodesContent.find((content: any) => content.nodeId === nodeId);
          if (nodeContent) {
            updated.set(nodeId, nodeContent);
          }
        });
        return updated;
      });

      setIsUpdatingContext(false);
    }, 100);
  }, [id]);

  // Update getEnvironmentContext to provide richer context about connected nodes
  const getEnvironmentContext = useCallback(() => {
    const context = [
      localSettings.environmentPrompt || DEFAULT_ENVIRONMENT_PROMPT,
      "\nCurrent Environment Status:",
      `Connected Nodes: ${connectedNodes.size}`,
      "\nDetailed Node Information:"
    ];

    connectedNodes.forEach((nodeData, nodeId) => {
      const nodeType = nodeData.type;
      context.push(`\n## ${nodeType} Node (${nodeId})`);
      
      // Add node capabilities
      if (nodeData.capabilities?.length > 0) {
        context.push(`Capabilities: ${nodeData.capabilities.join(', ')}`);
      }

      // Add node content based on type
      if (nodeData.content) {
        switch (nodeType) {
          case 'notesNode':
            context.push('Notes Content:');
            // Handle both string content and object content
            const notesContent = typeof nodeData.content === 'string' 
              ? nodeData.content 
              : nodeData.content.text || nodeData.content;
            context.push(notesContent);
            break;
          case 'imageNode':
            context.push('Image Caption:');
            context.push(nodeData.content.caption || 'No caption available');
            if (nodeData.content.description) {
              context.push('Image Description:');
              context.push(nodeData.content.description);
            }
            break;
          case 'documentNode':
            context.push('Document Title:');
            context.push(nodeData.content.title || 'Untitled');
            if (nodeData.content.text) {
              context.push('Document Content:');
              context.push(nodeData.content.text);
            }
            break;
          case 'urlNode':
            context.push('URL Information:');
            context.push(`Title: ${nodeData.content.title || 'No title'}`);
            if (nodeData.content.description) {
              context.push(`Description: ${nodeData.content.description}`);
            }
            break;
        }
      }
      context.push(''); // Add empty line between nodes
    });

    // Add instructions for the AI about how to use connected nodes
    context.push(`\nInstructions for Using Connected Nodes:
1. You can reference content from any connected node in your responses
2. When asked about connected nodes, list them and their content
3. Use the information from connected nodes to enhance your responses
4. You can request updates from connected nodes if needed
5. Treat connected nodes' content as part of your knowledge base`);

    return context.join('\n');
  }, [connectedNodes, localSettings.environmentPrompt]);

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

  // Update the edge changes handler with error handling
  useEffect(() => {
    const handleEdgeChanges = () => {
      try {
        const edges = getEdges();
        const updatedConnectedNodes = new Map();
        
        edges.forEach(edge => {
          if (edge.source === id || edge.target === id) {
            const connectedId = edge.source === id ? edge.target : edge.source;
            const connectedNode = getNode(connectedId);
            if (connectedNode) {
              updatedConnectedNodes.set(connectedId, {
                type: connectedNode.type,
                nodeId: connectedId,
                capabilities: nodeCapabilityService.getCapabilities(connectedId) || []
              });
            }
          }
        });

        setConnectedNodes(updatedConnectedNodes);
        
        const context = getEnvironmentContext();
        console.log('Edges changed, updating context:', context);
        
        messageBus.emit('context_updated', {
          senderId: id,
          content: context,
          type: 'context',
          metadata: {
            nodeId: id,
            connectedNodes: Array.from(updatedConnectedNodes.keys())
          }
        });
      } catch (error) {
        console.error('Error handling edge changes:', error);
      }
    };

    try {
      window.addEventListener('connect', handleEdgeChanges);
      window.addEventListener('edge.added', handleEdgeChanges);
      window.addEventListener('edge.removed', handleEdgeChanges);

      handleEdgeChanges();

      return () => {
        window.removeEventListener('connect', handleEdgeChanges);
        window.removeEventListener('edge.added', handleEdgeChanges);
        window.removeEventListener('edge.removed', handleEdgeChanges);
      };
    } catch (error) {
      console.error('Error setting up edge change listeners:', error);
    }
  }, [id, getEdges, getNode, getEnvironmentContext, nodeCapabilityService]);

  // Add this effect to handle note save confirmations
  useEffect(() => {
    const unsubscribeNoteSave = nodeMessageService.subscribe(id, 'note_save', (message: NodeMessage) => {
      console.log('ChatNode received note save confirmation:', message);
      // Add a confirmation message to the chat
      const confirmationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: 'Note has been saved successfully.',
        timestamp: Date.now(),
      };
      
      updateNode(id, {
        ...safeData,
        messages: [...(safeData.messages || []), confirmationMessage],
      });
    });

    return () => {
      unsubscribeNoteSave();
    };
  }, [id, safeData, updateNode]);

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
        // Validate GitHub token
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${localApiKey}`
          }
        });

        isValid = response.ok;
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Invalid GitHub token. Please check your credentials.');
        }
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
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setValidationMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to validate API key'
      });
    } finally {
      setIsValidatingKey(false);
    }
  }, [id, safeData, localSettings, localApiKey, updateNode]);

  // Update createAndSendNote function
  const createAndSendNote = async (content: string, isQuestion: boolean, connectedNotesNodes: string[]) => {
    try {
      const systemContext = [
        safeData.settings.systemPrompt || localSettings.systemPrompt,
        "",
        getEnvironmentContext(),
        "\nIMPORTANT: When taking notes or answering questions that should be saved as notes:\n" +
        "1. Your response should be formatted as a clean, well-structured note\n" +
        "2. Do not include any meta-commentary or formatting instructions\n" +
        "3. Focus on providing clear, concise, and accurate information\n" +
        "4. The entire response will be saved as a note\n"
      ].join('\n');

      const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${safeData.settings.apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          message: isQuestion ?
            `Please answer this question in a clear, note-friendly format: ${content}`
            :
            `Please format this content as a clean, well-structured note: ${content}`,
          model: safeData.settings.model,
          temperature: safeData.settings.temperature,
          max_tokens: safeData.settings.maxTokens,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const result = await response.json();
      const noteContent = result.text || (result.message && result.message.text);

      if (!noteContent) {
        throw new Error('No response content found');
      }

      // Send the note content to all connected notes nodes
      let noteSent = false;
      for (const noteNodeId of connectedNotesNodes) {
        console.log('Sending note to node:', noteNodeId);
        try {
          nodeMessageService.sendNoteDraft(id, noteNodeId, noteContent);
          noteSent = true;
        } catch (error) {
          console.error('Error sending note to node:', noteNodeId, error);
        }
      }

      // Return a simple confirmation message for the chat
      return noteSent ? "Note has been sent to the Notes node for review." : "Failed to send note to connected nodes. Please try again.";
    } catch (error) {
      console.error('Error in createAndSendNote:', error);
      throw error;
    }
  };

  // Update handleSendMessage to handle note requests more directly
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
      // Find connected notes nodes
      const connectedNotesNodes = Array.from(connectedNodes.entries())
        .filter(([_, nodeData]) => {
          console.log('Checking node data:', nodeData);
          const isNotesNode = nodeData.type === 'notesNode' || nodeData.type === 'notes';
          console.log('Is notes node:', isNotesNode);
          return isNotesNode;
        })
        .map(([nodeId]) => {
          console.log('Found notes node:', nodeId);
          return nodeId;
        });

      console.log('Note-taking enabled:', isNoteTakingEnabled);
      console.log('Connected Notes Nodes:', connectedNotesNodes);
      console.log('All connected nodes:', connectedNodes);

      // Regular chat message processing
      const systemContext = [
        safeData.settings.systemPrompt || localSettings.systemPrompt,
        "",
        getEnvironmentContext(),
        isNoteTakingEnabled ? 
          "\nIMPORTANT: You are in note-taking mode. Format your response as a clear, concise note." 
          : ""
      ].join('\n');

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
      const responseText = result.text || (result.message && result.message.text);

      if (!responseText) {
        throw new Error('No response text found in API response');
      }

      // If note-taking is enabled and we have connected notes nodes, send as note
      if (isNoteTakingEnabled && connectedNotesNodes.length > 0) {
        console.log('ChatNode: Note-taking mode active, sending to nodes:', connectedNotesNodes);
        
        // Send to all connected notes nodes
        let noteSent = false;
        for (const noteNodeId of connectedNotesNodes) {
          try {
            console.log('ChatNode: Sending note to node:', noteNodeId);
            
            // Format the note content
            const noteContent = `Q: ${userMessage.content}\nA: ${responseText}\n---\n`;
            
            // Get the current node data
            const notesNode = getNode(noteNodeId);
            if (!notesNode) {
              throw new Error('Notes node not found');
            }
            
            // Create new note object
            const newNote = {
              id: crypto.randomUUID(),
              content: noteContent.trim()
            };
            
            // Update the NotesNode data with the new note
            const currentNotes = notesNode.data.notes || [];
            updateNode(noteNodeId, {
              ...notesNode.data,
              notes: [...currentNotes, newNote]
            });
            
            console.log('ChatNode: Successfully updated notes array');
            noteSent = true;
          } catch (error) {
            console.error('ChatNode: Error updating notes:', error);
          }
        }

        // Only show confirmation message in chat
        const confirmationMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: noteSent ? "Note has been saved to Notes node." : "Failed to save note.",
          timestamp: Date.now(),
        };

        // Update chat with just the confirmation
        updateNode(id, {
          ...safeData,
          messages: [...updatedMessages, confirmationMessage],
        });
      } else {
        console.log('Not sending note - conditions not met:', {
          isNoteTakingEnabled,
          hasConnectedNodes: connectedNotesNodes.length > 0
        });
        // Normal chat mode - show the full response
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: responseText,
          timestamp: Date.now(),
        };

        updateNode(id, {
          ...safeData,
          messages: [...updatedMessages, assistantMessage],
        });
      }

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'error' as const,
        content: error instanceof Error ? error.message : 'Failed to send message',
        timestamp: Date.now(),
      };

      updateNode(id, {
        ...safeData,
        messages: [...updatedMessages, errorMessage],
      });
    }
  }, [id, safeData, input, updateNode, getEnvironmentContext, localSettings.systemPrompt, connectedNodes, isNoteTakingEnabled]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleResetChat = useCallback(() => {
    updateNode(id, {
      ...safeData,
      messages: []
    });
  }, [id, safeData, updateNode]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Add this before the return statement
  const handleToggleNoteTaking = useCallback(() => {
    setIsNoteTakingEnabled(prev => !prev);
  }, []);

  return (
    <ChatNodeErrorBoundary>
      <BaseNode id={id} data={safeData} selected={selected}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '400px',
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
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {hasConnectedNotesNode && (
                <Button
                  size="small"
                  variant={isNoteTakingEnabled ? "contained" : "outlined"}
                  color={isNoteTakingEnabled ? "primary" : "inherit"}
                  onClick={handleToggleNoteTaking}
                  sx={{ minWidth: 'auto', p: '4px 8px' }}
                >
                  {isNoteTakingEnabled ? "Taking Notes" : "Take Notes"}
                </Button>
              )}
              <IconButton
                size="small"
                onClick={handleResetChat}
                title="Reset Chat"
                color="primary"
              >
                <RecyclingIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleSettingsOpen}
                title="Settings"
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Box>
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
                    width: '100%'
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    {message.role}
                  </Typography>
                  <Box sx={{ 
                    maxWidth: '80%',
                    width: message.role === 'error' ? '100%' : 'auto',
                    position: 'relative',
                  }}>
                    {message.role === 'error' ? (
                      <ErrorMessage message={message.content} />
                    ) : (
                      <Paper
                        sx={{
                          p: 1,
                          pr: 4,
                          bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                          color: message.role === 'user' ? 'primary.contrastText' : 'inherit',
                          position: 'relative',
                        }}
                      >
                        <ListItemText
                          primary={message.content}
                          sx={{ 
                            m: 0,
                            '& .MuiTypography-root': {
                              fontSize: '0.8rem',
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleCopyMessage(message.content)}
                          sx={{
                            position: 'absolute',
                            right: 4,
                            top: 4,
                            color: message.role === 'user' ? 'primary.contrastText' : 'primary.main',
                            opacity: 0.7,
                            '&:hover': {
                              opacity: 1
                            }
                          }}
                          title="Copy message"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    )}
                  </Box>
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