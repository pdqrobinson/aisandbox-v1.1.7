import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  Paper, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  CircularProgress, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Tabs,
  Tab,
  Slider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import { Send as SendIcon, Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import { AINodeData, Message, SharedMessage } from '../types/nodes';
import { CohereClientV2 } from "cohere-ai";
import { useSandboxState, AIAgent } from '../services/SandboxState';
import { InteractionManager, InteractionContext, INTERACTION_CAPABILITIES } from '../services/InteractionRules';
import { AIRoleManager, AIRole } from '../services/AIRoles';
import { AgentBehaviorManager, AgentAction, AgentState } from '../services/AgentBehavior';

interface AINodeProps {
  data: AINodeData;
  id: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  dashboardUrl?: string;
}

interface SharedConversation {
  id: string;
  participants: string[];
  messages: Message[];
  lastMessage: Date;
}

const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI Models
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Most capable model for complex tasks',
    dashboardUrl: 'https://platform.openai.com/'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and efficient for most tasks',
    dashboardUrl: 'https://platform.openai.com/'
  },
  {
    id: 'gpt-4-vision',
    name: 'GPT-4 Vision',
    provider: 'OpenAI',
    description: 'Can analyze images and text',
    dashboardUrl: 'https://platform.openai.com/'
  },
  // Cohere Models
  {
    id: 'command-a-03-2025',
    name: 'Command',
    provider: 'Cohere',
    description: 'Best for text generation and analysis',
    dashboardUrl: 'https://dashboard.cohere.com/'
  },
  {
    id: 'command-light-a-03-2025',
    name: 'Command Light',
    provider: 'Cohere',
    description: 'Faster, lighter version of Command',
    dashboardUrl: 'https://dashboard.cohere.com/'
  },
  {
    id: 'command-nightly-a-03-2025',
    name: 'Command Nightly',
    provider: 'Cohere',
    description: 'Latest experimental features',
    dashboardUrl: 'https://dashboard.cohere.com/'
  }
];

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SANDBOX_CONTEXT = `You are an AI agent in a shared sandbox environment. Here's what you need to know:

1. You are part of a network of AI agents that can interact with each other
2. You can receive messages from other agents and respond to them
3. You have access to your own capabilities and can use them to help other agents
4. You should be aware of your role and limitations within the sandbox
5. You can communicate with other agents through the message system

When interacting:
- Be clear about your capabilities and limitations
- Help other agents when appropriate
- Maintain context of the sandbox environment
- Use your specific model capabilities to assist others

Remember: You are part of a collaborative environment where multiple AI agents work together.`;

export function AINode({ data, id }: AINodeProps) {
  const [tabValue, setTabValue] = useState(0);
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  
  // Set initial model value to the first Cohere model
  const [selectedModel, setSelectedModel] = useState('command-a-03-2025');
  const [temperature, setTemperature] = useState(data.temperature || 0.7);
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [nodeId] = useState(() => `node-${Math.random().toString(36).substr(2, 9)}`);
  const { addAgent, updateAgent, removeAgent, getActiveAgents } = useSandboxState();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const roleManager = AIRoleManager.getInstance();
  const [sharedConversations, setSharedConversations] = useState<Map<string, SharedConversation>>(new Map());
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const behaviorManager = AgentBehaviorManager.getInstance();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);

  // Register this node in the sandbox state
  useEffect(() => {
    const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    if (selectedModelData) {
      const agent: AIAgent = {
        id: nodeId,
        name: `${selectedModelData.provider} - ${selectedModelData.name}`,
        model: selectedModel,
        provider: selectedModelData.provider,
        status: 'active' as const,
        lastSeen: new Date(),
        capabilities: [
          'text-generation',
          'chat',
          selectedModelData.provider === 'Cohere' ? 'cohere-specific' : 'openai-specific'
        ]
      };
      addAgent(agent);
    }

    return () => {
      removeAgent(nodeId);
    };
  }, [nodeId, selectedModel]);

  // Update agent status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateAgent(nodeId, {
        lastSeen: new Date()
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [nodeId]);

  // Handle role selection
  const handleRoleChange = (event: SelectChangeEvent<string>) => {
    const newRole = event.target.value;
    setSelectedRole(newRole);
    roleManager.assignRole(id, newRole);
  };

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setValidationStatus({
        type: 'error',
        message: 'Please enter an API key'
      });
      setShowValidation(true);
      return false;
    }

    try {
      setLoading(true);
      const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (!selectedModelData) {
        throw new Error('Invalid model selected');
      }

      if (selectedModelData.provider === 'Cohere') {
        const client = new CohereClientV2({ token: apiKey });
        await client.chat({
          model: selectedModel,
          messages: [{
            role: 'user',
            content: 'Test message'
          }],
          temperature: 0.7
        });
      } else {
        // OpenAI validation would go here
        throw new Error('OpenAI integration not implemented yet');
      }

      setValidationStatus({
        type: 'success',
        message: 'API key validated successfully'
      });
      return true;
    } catch (err) {
      setValidationStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid API key'
      });
      return false;
    } finally {
      setLoading(false);
      setShowValidation(true);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const isValid = await validateApiKey();
      if (isValid) {
        // Here you would typically update the node data through a callback
        // For now, we'll just show a success message
        setValidationStatus({
          type: 'success',
          message: 'Settings saved successfully'
        });
        setShowValidation(true);
      }
    } catch (err) {
      setValidationStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save settings'
      });
      setShowValidation(true);
    } finally {
      setSaving(false);
    }
  };

  // Handle new connections
  useEffect(() => {
    if (data.connectedNodes.size > 0) {
      // Create or update shared conversations
      data.connectedNodes.forEach(connectedNodeId => {
        const conversationId = [id, connectedNodeId].sort().join('-');
        if (!sharedConversations.has(conversationId)) {
          setSharedConversations(prev => {
            const newConversations = new Map(prev);
            newConversations.set(conversationId, {
              id: conversationId,
              participants: [id, connectedNodeId],
              messages: [],
              lastMessage: new Date()
            });
            return newConversations;
          });
        }
      });
    }
  }, [data.connectedNodes]);

  // Handle incoming messages from connected nodes
  useEffect(() => {
    if (data.messages.length > 0) {
      const lastMessage = data.messages[data.messages.length - 1];
      const conversationId = [id, lastMessage.from].sort().join('-');
      
      setSharedConversations(prev => {
        const newConversations = new Map(prev);
        const conversation = newConversations.get(conversationId);
        if (conversation) {
          newConversations.set(conversationId, {
            ...conversation,
            messages: [...conversation.messages, lastMessage.message],
            lastMessage: new Date()
          });
        }
        return newConversations;
      });
    }
  }, [data.messages]);

  // Initialize agent when component mounts
  useEffect(() => {
    behaviorManager.initializeAgent(id, id);
    const state = behaviorManager.getAgentState(id);
    if (state) {
      setAgentState(state);
    }
  }, [id]);

  // Handle agent actions
  const handleAgentAction = async (action: AgentAction) => {
    const success = await behaviorManager.executeAction(id, action);
    if (success) {
      // Update local state
      const updatedState = behaviorManager.getAgentState(id);
      if (updatedState) {
        setAgentState(updatedState);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    // Add message to local messages
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (!selectedModelData) {
        throw new Error('Invalid model selected');
      }

      // Get active agents for context
      const activeAgents = getActiveAgents().filter(agent => agent.id !== nodeId);
      const agentsContext = activeAgents.length > 0
        ? `\n\nActive agents in the sandbox:\n${activeAgents.map(agent => {
            const role = roleManager.getRole(agent.id);
            return `- ${role?.name || 'Unknown Role'} (${agent.provider})`;
          }).join('\n')}`
        : '';

      // Get the system prompt for this node's role
      const roleSystemPrompt = roleManager.getSystemPrompt(id);

      // Get conversation context if in a shared conversation
      const conversationContext = activeConversation 
        ? sharedConversations.get(activeConversation)?.messages
          .slice(-5) // Last 5 messages for context
          .map(m => `${m.role}: ${m.content}`)
          .join('\n')
        : '';

      let result: string;
      if (selectedModelData.provider === 'Cohere') {
        const client = new CohereClientV2({ token: apiKey });
        const response = await client.chat({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: `${SANDBOX_CONTEXT}\n\n${roleSystemPrompt}\n\n${agentsContext}\n\n${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}${systemPrompt || ''}`
            },
            {
              role: 'user',
              content: inputMessage
            }
          ],
          temperature: temperature
        });
        result = response.message.content?.[0]?.text || 'No response from model';
      } else {
        // OpenAI integration would go here
        throw new Error('OpenAI integration not implemented yet');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: result,
        timestamp: new Date(),
      };

      // Add assistant message to local messages
      setMessages(prev => [...prev, assistantMessage]);

      // Share messages with connected nodes using role-based interaction rules
      if (data.connectedNodes.size > 0) {
        const messageCapability = INTERACTION_CAPABILITIES.find(cap => cap.id === 'message');
        
        if (messageCapability) {
          // Share with each connected node
          data.connectedNodes.forEach(targetId => {
            if (roleManager.canInteract(id, targetId, 'message')) {
              const messageToShare = {
                from: id,
                message: assistantMessage,
                timestamp: new Date()
              };

              // Record the interaction
              const interactionManager = InteractionManager.getInstance();
              const sourceAgent = {
                id: nodeId,
                name: `${selectedModelData.provider} - ${selectedModelData.name}`,
                model: selectedModel,
                provider: selectedModelData.provider,
                status: 'active' as const,
                lastSeen: new Date(),
                capabilities: ['text-generation', 'chat'],
                connectedNodes: data.connectedNodes
              };

              const targetAgent = activeAgents.find(agent => agent.id === targetId);
              if (targetAgent) {
                interactionManager.recordInteraction({
                  sourceAgent,
                  targetAgent,
                  capability: messageCapability,
                  timestamp: new Date()
                });
              }

              // Update the node's data to include the new message
              const updatedData = {
                ...data,
                messages: [...data.messages, messageToShare]
              };

              // This would typically be handled through a callback or context
              // For now, we'll just log it
              console.log('Sharing message with connected node:', targetId, messageToShare);
            }
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    console.log('Model changed to:', event.target.value);
    setSelectedModel(event.target.value);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 0,
        width: 500,
        height: 600,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '& .react-flow__handle': {
          width: 12,
          height: 12,
          background: '#1a192b',
          border: '2px solid #fff',
          borderRadius: '50%',
          transition: 'background-color 0.2s',
          '&:hover': {
            background: '#4a90e2',
            borderColor: '#fff',
          }
        }
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ top: -6 }}
      />
      <Handle 
        type="source" 
        position={Position.Top} 
        style={{ top: -6 }}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        style={{ right: -6 }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ right: -6 }}
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        style={{ bottom: -6 }}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ bottom: -6 }}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ left: -6 }}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        style={{ left: -6 }}
      />
      
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        bgcolor: 'background.default',
        cursor: 'move'
      }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {selectedModelData ? `${selectedModelData.provider} - ${selectedModelData.name}` : 'AI Node'}
        </Typography>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{ minHeight: 'auto' }}
        >
          <Tab 
            label="Chat" 
            sx={{ 
              minHeight: 'auto',
              py: 1,
              px: 2
            }}
          />
          <Tab 
            label="Settings" 
            sx={{ 
              minHeight: 'auto',
              py: 1,
              px: 2
            }}
          />
          <Tab 
            label="Agent" 
            sx={{ 
              minHeight: 'auto',
              py: 1,
              px: 2
            }}
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          gap: 2,
          overflow: 'hidden'
        }}>
          {sharedConversations.size > 0 && (
            <Box sx={{ px: 2, pt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Conversation</InputLabel>
                <Select
                  value={activeConversation || ''}
                  label="Conversation"
                  onChange={(e) => setActiveConversation(e.target.value as string)}
                >
                  <MenuItem value="">
                    <em>Direct Messages</em>
                  </MenuItem>
                  {Array.from(sharedConversations.values()).map((conversation) => (
                    <MenuItem 
                      key={conversation.id} 
                      value={conversation.id}
                    >
                      <Box>
                        <Typography variant="body2">
                          Chat with {conversation.participants.find(p => p !== id)}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {conversation.messages.length} messages
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <List sx={{ 
            flexGrow: 1, 
            overflow: 'auto',
            bgcolor: 'background.paper',
            '& .MuiListItem-root': {
              flexDirection: 'column',
              alignItems: 'flex-start',
              py: 1.5,
            },
            '& .MuiListItemText-root': {
              width: '100%',
            },
          }}>
            {(activeConversation 
              ? sharedConversations.get(activeConversation)?.messages || []
              : messages
            ).map((message, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          bgcolor: message.role === 'assistant' ? 'action.hover' : 'transparent',
                          p: 1.5,
                          borderRadius: 1,
                          maxWidth: '100%',
                          overflow: 'auto'
                        }}
                      >
                        {message.content}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < (activeConversation 
                  ? sharedConversations.get(activeConversation)?.messages.length || 0
                  : messages.length
                ) - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>

          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            p: 1, 
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider'
          }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: 'background.paper'
                }
              }}
            />
            <IconButton 
              color="primary" 
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              sx={{ 
                alignSelf: 'flex-end',
                mb: 0.5
              }}
            >
              {loading ? <CircularProgress size={24} /> : <SendIcon />}
            </IconButton>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mx: 1,
                mb: 1
              }}
            >
              {error}
            </Alert>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          p: 2,
          height: '100%',
          overflow: 'auto'
        }}>
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={handleRoleChange}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 300
                  }
                }
              }}
            >
              {roleManager.getAvailableRoles().map((role) => (
                <MenuItem 
                  key={role.id} 
                  value={role.id}
                  sx={{ py: 1 }}
                >
                  <Box>
                    <Typography variant="body2">
                      {role.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {role.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModel}
              label="Model"
              onChange={handleModelChange}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 300
                  }
                }
              }}
            >
              {AVAILABLE_MODELS.map((model) => (
                <MenuItem 
                  key={model.id} 
                  value={model.id}
                  sx={{ py: 1 }}
                >
                  <Box>
                    <Typography variant="body2">
                      {model.provider} - {model.name}
                    </Typography>
                    {model.description && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {model.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {selectedModelData?.dashboardUrl && (
              <Typography 
                variant="caption" 
                sx={{ mt: 1, display: 'block' }}
              >
                <a 
                  href={selectedModelData.dashboardUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Get API key from {selectedModelData.provider} dashboard
                </a>
              </Typography>
            )}
          </FormControl>
          
          <TextField
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            fullWidth
            helperText={`Enter your ${selectedModelData?.provider} API key`}
            error={validationStatus?.type === 'error'}
          />

          <TextField
            label="System Prompt"
            multiline
            rows={3}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            fullWidth
            helperText="Additional instructions for the AI model (will be combined with sandbox context)"
          />

          <Box>
            <Typography gutterBottom>
              Temperature: {temperature}
            </Typography>
            <Slider
              value={temperature}
              onChange={(_, value) => setTemperature(value as number)}
              min={0}
              max={1}
              step={0.1}
              marks
            />
            <Typography variant="caption" color="text.secondary">
              Higher values make the output more random, lower values make it more focused
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSaveSettings}
            disabled={saving || loading}
            fullWidth
            sx={{ mt: 'auto' }}
          >
            Save Settings
          </Button>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          p: 2,
          height: '100%',
          overflow: 'auto'
        }}>
          {agentState && (
            <>
              <Typography variant="h6">Agent State</Typography>
              <Box sx={{ 
                bgcolor: 'background.paper',
                p: 2,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider'
              }}>
                <Typography variant="body2">
                  Current Node: {agentState.currentNodeId}
                </Typography>
                <Typography variant="body2">
                  Collected Data: {agentState.collectedData.length} items
                </Typography>
                <Typography variant="body2">
                  Successful Actions: {agentState.performance.successfulActions}
                </Typography>
                <Typography variant="body2">
                  Failed Actions: {agentState.performance.failedActions}
                </Typography>
                <Typography variant="body2">
                  Total Reward: {agentState.performance.totalReward}
                </Typography>
              </Box>

              <Typography variant="h6">Action History</Typography>
              <List>
                {agentState.history.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`${action.type} -> ${action.targetId}`}
                      secondary={action.timestamp.toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    const connectedNodeId = data.connectedNodes.values().next().value as string;
                    handleAgentAction({
                      type: 'interact',
                      targetId: connectedNodeId,
                      timestamp: new Date()
                    });
                  }}
                  disabled={data.connectedNodes.size === 0}
                  fullWidth
                >
                  Interact with Connected Node
                </Button>
              </Box>
            </>
          )}
        </Box>
      </TabPanel>

      <Snackbar
        open={showValidation}
        autoHideDuration={6000}
        onClose={() => setShowValidation(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowValidation(false)} 
          severity={validationStatus?.type || 'info'}
          sx={{ width: '100%' }}
        >
          {validationStatus?.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
} 