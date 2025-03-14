import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  CircularProgress, 
  Tabs,
  Tab,
  Slider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Snackbar,
  Grid,
  Chip,
  Tooltip,
  FormControlLabel,
  Switch,
  Stack,
  Checkbox,
  Popover,
  ListItemButton
} from '@mui/material';
import { Send as SendIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Message, SharedMessage, ModelOption, Agent } from '../types/sandbox';
import { CohereClientV2 } from 'cohere-ai';
import { useSandboxState, AIAgent } from '../services/SandboxState';
import { AIRoleManager } from '../services/AIRoles';
import { AgentBehaviorManager, AgentState } from '../services/AgentBehavior';
import { format } from 'date-fns';
import { NodeCommunicationService, NodeMessage, NodeConnection } from '../services/NodeCommunicationService';
import { useSandbox } from '../contexts/SandboxContext';
import { Node, Edge } from 'reactflow';

interface AINodeData {
  name: string;
  agent: Agent;
  messages: Message[];
  apiKey?: string;
  temperature?: number;
  systemPrompt?: string;
  role?: string;
  connectedNodes: string[];
}

interface AINodeProps {
  id: string;
  data: AINodeData;
  selected: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface SharedConversation {
  id: string;
  participants: string[];
  messages: Message[];
  lastMessage: number;
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'command',
    name: 'Command',
    description: "Cohere's flagship model for chat and text generation",
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'command',
    provider: 'Cohere'
  },
  {
    id: 'command-light',
    name: 'Command Light',
    description: 'A faster, lighter version of Command',
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'command-light',
    provider: 'Cohere'
  },
  {
    id: 'command-nightly',
    name: 'Command Nightly',
    description: 'Latest experimental version of Command',
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'command-nightly',
    provider: 'Cohere'
  },
  {
    id: 'command-light-nightly',
    name: 'Command Light Nightly',
    description: 'Latest experimental version of Command Light',
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'command-light-nightly',
    provider: 'Cohere'
  }
];

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      style={{
        visibility: value === index ? 'visible' : 'hidden',
        opacity: value === index ? 1 : 0,
        position: 'absolute',
        width: '100%',
        height: '100%',
        transition: 'opacity 0.2s ease-in-out',
        overflow: 'hidden'
      }}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      <Box sx={{ 
        p: 1, 
        height: '100%', 
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#888',
          borderRadius: '3px',
          '&:hover': {
            background: '#555',
          },
        },
      }}>
        {children}
      </Box>
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

const calculateAverageResponseTime = (messages: Message[]): number => {
  if (!messages || messages.length === 0) return 0;
  
  let totalResponseTime = 0;
  let responseCount = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const currentMessage = messages[i];
    const previousMessage = messages[i - 1];
    
    if (currentMessage.timestamp && previousMessage.timestamp) {
      const responseTime = new Date(currentMessage.timestamp).getTime() - new Date(previousMessage.timestamp).getTime();
      totalResponseTime += responseTime;
      responseCount++;
    }
  }
  
  return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
};

const AINode: React.FC<AINodeProps> = ({ id, data }) => {
  const roleManager = AIRoleManager.getInstance();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [tabValue, setTabValue] = useState(0);
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [selectedModel, setSelectedModel] = useState('command-a-03-2025');
  const [temperature, setTemperature] = useState(data.temperature || 0.7);
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
  const [messages, setMessages] = useState<Message[]>(data.messages || []);
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
  const [selectedRole, setSelectedRole] = useState<string>(() => {
    if (data.role) {
      return data.role;
    }
    const availableRoles = roleManager.getAvailableRoles();
    return availableRoles[0]?.id || 'worker';
  });
  const [sharedConversations, setSharedConversations] = useState<Map<string, SharedConversation>>(new Map());
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const behaviorManager = AgentBehaviorManager.getInstance();
  const [messageStats, setMessageStats] = useState({
    successful: 0,
    failed: 0,
    total: 0
  });
  const [processedMessageIds] = useState(() => new Set<string>());
  const [isParent, setIsParent] = useState(false);
  const [parentNodeId, setParentNodeId] = useState<string | null>(null);
  const [modelAnchorEl, setModelAnchorEl] = useState<null | HTMLElement>(null);
  const modelOpen = Boolean(modelAnchorEl);
  useSandbox();
  const [] = useState<Node[]>([]);
  const [] = useState<Edge[]>([]);
  const [] = useState(false);

  // Initialize communication service
  const nodeCommunication = useRef(NodeCommunicationService.getInstance());

  // Add effect to initialize role
  useEffect(() => {
    if (!data.role) {
      // If no role is set in data, set the first available role
      const availableRoles = roleManager.getAvailableRoles();
      const defaultRole = availableRoles[0]?.id || 'worker';
      setSelectedRole(defaultRole);
      roleManager.assignRole(id, defaultRole);
      // Update the agent in sandbox state with the default role
      updateAgent(nodeId, {
        role: defaultRole,
        lastSeen: new Date()
      });
    }
  }, [data.role, id, nodeId, updateAgent]);

  // Handle role selection
  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    roleManager.assignRole(id, roleId);
    
    // Update the agent in sandbox state with the new role
    updateAgent(nodeId, {
      role: roleId,
      lastSeen: new Date()
    });
  };

  // Update parent status in sandbox state when it changes
  useEffect(() => {
    updateAgent(nodeId, {
      isParent: isParent,
      lastSeen: new Date()
    });
  }, [nodeId, isParent, updateAgent]);

  // Update parent status when sandbox state changes
  useEffect(() => {
    const agent = getActiveAgents().find(a => a.id === nodeId);
    if (agent) {
      setIsParent(agent.isParent || false);
      setParentNodeId(agent.parentNodeId || null);
    }
  }, [nodeId, getActiveAgents]);

  // Handle parent status change
  const handleParentStatusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIsParent = event.target.checked;
    setIsParent(newIsParent);
    
    // If becoming a parent, clear any existing parent relationship
    if (newIsParent) {
      setParentNodeId(null);
      updateAgent(nodeId, {
        isParent: true,
        parentNodeId: null,
        lastSeen: new Date()
      });
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
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
        ],
        isParent: isParent,
        role: selectedRole // Add role to agent data
      };
      addAgent(agent);
    }

    return () => {
      removeAgent(nodeId);
    };
  }, [nodeId, selectedModel, isParent, selectedRole]); // Add selectedRole to dependencies

  // Update agent status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateAgent(nodeId, {
        lastSeen: new Date(),
        isParent: isParent,
        role: selectedRole // Include role in periodic updates
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [nodeId, isParent, selectedRole]); // Add selectedRole to dependencies

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
        throw new Error('No model selected. Please select a model before sending messages.');
      }

      if (!selectedModelData.model) {
        throw new Error('Selected model is not properly configured. Please check the model settings.');
      }


      if (selectedModelData.provider === 'Cohere') {
        const response = await fetch('http://localhost:3002/api/cohere/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            message: 'Test message',
            model: selectedModelData.model || 'command',
            preamble: `${SANDBOX_CONTEXT}\n\n${selectedModelData.systemPrompt}`,
            temperature: 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.text) {
          throw new Error('Invalid response from API');
        }
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
    if (data.connectedNodes && data.connectedNodes.length > 0) {
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
              lastMessage: 0
            });
            return newConversations;
          });
        }
      });
    }
  }, [data.connectedNodes, id]);

  // Handle incoming messages for parent node
  const handleIncomingMessage = async (message: NodeMessage) => {
    // Skip if we've already processed this message
    if (processedMessageIds.has(message.id)) {
      return;
    }

    // Mark message as processed immediately to prevent loops
    processedMessageIds.add(message.id);

    const localMessage: Message = {
      id: message.id,
      from: message.from,
      to: message.to,
      role: message.metadata.role,
      content: message.content,
      timestamp: message.timestamp,
      status: message.status === 'delivered' ? 'delivered' : message.status === 'failed' ? 'failed' : 'sent'
    };

    // Add to local messages
    setMessages(prev => [...prev, localMessage]);

    // Update shared conversations if needed
    const conversationId = message.from;
    const conversation = sharedConversations.get(conversationId) || {
      id: conversationId,
      participants: [id, message.from],
      messages: [],
      lastMessage: Date.now()
    };

    const newConversations = new Map(sharedConversations);
    newConversations.set(conversationId, {
      ...conversation,
      messages: [...conversation.messages, localMessage],
      lastMessage: Date.now()
    });
    setSharedConversations(newConversations);

    // Process message if:
    // 1. It's a user message and we're either:
    //    - A child node receiving a transformed message
    //    - A standalone node
    // 2. It's an assistant message and the task isn't resolved
    if ((message.metadata.role === 'user' && 
         (!isParent && (message.metadata.processingInstructions === 'transformed_by_coordinator' || !parentNodeId))) ||
        (message.metadata.role === 'assistant' && !message.metadata.isTaskResolved)) {
      await processMessageWithAI(message);
    }
  };

  // Update message subscription effect
  useEffect(() => {
    // Establish connections with connected nodes
    if (data.connectedNodes) {
      data.connectedNodes.forEach(targetId => {
        const connection: NodeConnection = {
          nodeId: targetId,
          established: Date.now(),
          active: true
        };
        nodeCommunication.current.establishConnection(connection);
      });
    }

    const unsubscribe = nodeCommunication.current.subscribe(id, async (message: NodeMessage) => {
      // Skip if we've already processed this message
      if (processedMessageIds.has(message.id)) {
        return;
      }

      // Mark message as processed immediately to prevent loops
      processedMessageIds.add(message.id);

      // Always add incoming messages to local state
      const localMessage: Message = {
        id: message.id,
        from: message.from,
        to: message.to,
        role: message.metadata.role,
        content: message.content,
        timestamp: message.timestamp,
        status: message.status === 'delivered' ? 'delivered' : message.status === 'failed' ? 'failed' : 'sent'
      };
      setMessages(prev => [...prev, localMessage]);

      // Process messages based on node role
      if (message.metadata.role === 'user') {
        if (isParent || (!isParent && !parentNodeId)) {
          // Process with AI if we're a parent node or an independent node
          await processMessageWithAI(message);
        } else if (!isParent && parentNodeId) {
          // Process as a child node
          await handleChildTask(message);
        }
      }
    });

    return () => {
      // Remove connections when component unmounts
      if (data.connectedNodes) {
        data.connectedNodes.forEach(targetId => {
          nodeCommunication.current.removeConnection(targetId);
        });
      }
      unsubscribe();
    };
  }, [id, isParent, parentNodeId, data.connectedNodes]);

  // Update handleSendMessage to use NodeCommunicationService
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    try {
      setLoading(true);

      // Add user's message to local state immediately
      const userMessage: Message = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: id,
        to: parentNodeId || '*',
        role: 'user',
        content: inputMessage,
        timestamp: Date.now(),
        status: 'sent'
      };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // If this is a parent node, send immediate acknowledgment
      if (isParent) {
        const ackMessage: Message = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from: id,
          to: userMessage.from,
          role: 'assistant',
          content: "I'll work on that request and delegate it appropriately.",
          timestamp: Date.now(),
          status: 'delivered'
        };
        setMessages(prev => [...prev, ackMessage]);

        // Process and transform the message before sending to child nodes
        await processAndTransformMessage(userMessage);
      } else {
        // For non-parent nodes, handle normally
        const message: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
          from: id,
          to: parentNodeId || '*',
          content: inputMessage,
          type: parentNodeId ? 'direct' : 'broadcast',
          metadata: {
            role: 'user',
            processingInstructions: undefined
          }
        };

        const sentMessage = await nodeCommunication.current.sendMessage(message);
        
        // If this node has no parent, process with AI immediately
        if (!parentNodeId) {
          await processMessageWithAI(sentMessage);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // New function to process and transform messages for child nodes
  const processAndTransformMessage = async (originalMessage: Message) => {
    try {
      const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (!selectedModelData) {
        throw new Error('No model selected');
      }

      // Get current role for context
      const currentRole = roleManager.getRole(id);
      const roleContext = currentRole ? 
        `You are currently acting as: ${currentRole.name}\n${currentRole.description}\n\n` : '';

      // Create a prompt that asks the AI to transform the message
      const transformPrompt = `${roleContext}
As a coordinator, analyze the following request and transform it into clear, actionable instructions for a worker node.
Original request: "${originalMessage.content}"

Your task is to:
1. Understand the core objective
2. Break it down into clear steps
3. Add any necessary context or clarifications
4. Format it as instructions for a worker node

Respond with the transformed instructions only, no additional commentary.`;

      const response = await fetch('http://localhost:3002/api/cohere/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          message: transformPrompt,
          model: selectedModelData.model || 'command',
          temperature: temperature,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to transform message');
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error('Invalid response from API');
      }

      // Send transformed message to child nodes
      const connectedNodes = nodeCommunication.current.getConnectedNodes();
      if (connectedNodes && connectedNodes.length > 0) {
        const transformedMessage: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
          from: id,
          to: '*', // Send to all connected child nodes
          content: data.text,
          type: 'direct',
          metadata: {
            role: 'user',
            processingInstructions: 'transformed_by_coordinator',
            originalMessage: originalMessage.content
          }
        };

        await nodeCommunication.current.sendMessage(transformedMessage);
      }
    } catch (error) {
      console.error('Error transforming message:', error);
      setError('Failed to transform and delegate message. Please try again.');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleModelClick = (event: React.MouseEvent<HTMLElement>) => {
    setModelAnchorEl(event.currentTarget);
  };

  const handleModelClose = () => {
    setModelAnchorEl(null);
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    handleModelClose();
  };

  const updateMessageStats = useCallback(() => {
    const allMessages = data.messages.filter(m => m.role === 'assistant');
    setMessageStats({
      successful: allMessages.filter(m => m.status === 'delivered').length,
      failed: allMessages.filter(m => m.status === 'failed').length,
      total: allMessages.length
    });
  }, [data.messages]);

  useEffect(() => {
    updateMessageStats();
  }, [data.messages, updateMessageStats]);

  // Add reset functionality
  const handleResetNode = () => {
    // Clear messages
    setMessages([]);
    setInputMessage('');
    setError(null);
    setLoading(false);
    setMessageStats({
      successful: 0,
      failed: 0,
      total: 0
    });
    processedMessageIds.clear();
    setSharedConversations(new Map());
    setActiveConversation(null);
  };


  // Add auto-scroll effect
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Process messages with AI
  const processMessageWithAI = async (message: NodeMessage) => {
    try {
      const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (!selectedModelData) {
        throw new Error('No model selected');
      }

      // Get current role for context
      const currentRole = roleManager.getRole(id);
      const roleContext = currentRole ? 
        `You are currently acting as: ${currentRole.name}\n${currentRole.description}\n\n` : '';

      // Add task resolution context to the prompt
      const taskContext = `
You are part of a network of AI nodes working together to solve tasks. Your role is to:
1. Process the incoming message and determine if the task is fully resolved
2. If the task is not resolved:
   - Provide your contribution toward the solution
   - Clearly indicate what aspects still need to be addressed
   - Request specific information or actions needed from other nodes
3. If the task is resolved:
   - Provide the final solution
   - Explicitly state "TASK_RESOLVED" at the end of your message

Previous context: ${message.metadata.taskHistory || 'No previous context'}
Current request: ${message.content}`;

      const response = await fetch('http://localhost:3002/api/cohere/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          message: message.content,
          model: selectedModelData.model || 'command',
          preamble: `${roleContext}${taskContext}${selectedModelData.systemPrompt}`,
          temperature: temperature,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error('Invalid response from API');
      }

      // Check if the task is resolved
      const isTaskResolved = data.text.includes('TASK_RESOLVED');

      // Always add the AI response to local messages first
      const localMessage: Message = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: id,
        to: message.from,
        role: 'assistant',
        content: data.text,
        timestamp: Date.now(),
        status: 'delivered'
      };
      setMessages(prev => [...prev, localMessage]);

      // Update task history with the current interaction
      const updatedTaskHistory = message.metadata.taskHistory 
        ? `${message.metadata.taskHistory}\n\nNode ${id}: ${data.text}`
        : `Node ${id}: ${data.text}`;

      // If task is resolved and we have a parent node, send the final result up
      if (isTaskResolved && parentNodeId) {
        const finalMessage: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
          from: id,
          to: parentNodeId,
          content: data.text,
          type: 'direct',
          metadata: {
            role: 'assistant',
            taskHistory: updatedTaskHistory,
            isTaskResolved: true,
            originalRequest: message.metadata.originalRequest || message.content,
            finalResult: true // Mark this as the final result
          }
        };
        await nodeCommunication.current.sendMessage(finalMessage);
      } 
      // Otherwise, if we have connected nodes and aren't a parent, continue the conversation
      else if (!isTaskResolved && !isParent) {
        const connectedNodes = nodeCommunication.current.getConnectedNodes();
        if (connectedNodes && connectedNodes.length > 0) {
          const aiMessage: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
            from: id,
            to: message.from,
            content: data.text,
            type: 'direct',
            metadata: {
              role: 'assistant',
              taskHistory: updatedTaskHistory,
              isTaskResolved: isTaskResolved,
              originalRequest: message.metadata.originalRequest || message.content
            }
          };
          await nodeCommunication.current.sendMessage(aiMessage);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message to local messages
      const localErrorMessage: Message = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: id,
        to: message.from,
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: Date.now(),
        status: 'failed'
      };
      setMessages(prev => [...prev, localErrorMessage]);

      // Send error message if we have connected nodes
      const connectedNodes = nodeCommunication.current.getConnectedNodes();
      if (connectedNodes && connectedNodes.length > 0) {
        const errorMessage: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
          from: id,
          to: message.from,
          content: 'Sorry, there was an error processing your message. Please try again.',
          type: 'direct',
          metadata: {
            role: 'assistant',
            taskHistory: message.metadata.taskHistory,
            isTaskResolved: false,
            originalRequest: message.metadata.originalRequest
          }
        };
        await nodeCommunication.current.sendMessage(errorMessage);
      }
    }
  };

  // Update handleChildTask to handle task resolution
  const handleChildTask = async (message: NodeMessage) => {
    try {
      const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (!selectedModelData) {
        throw new Error('Invalid model selected');
      }

      // Get current role for context
      const currentRole = roleManager.getRole(id);
      const roleContext = currentRole ? 
        `You are currently acting as: ${currentRole.name}\n${currentRole.description}\n\n` : '';

      let result: string;
      if (selectedModelData.provider === 'Cohere') {
        const client = new CohereClientV2({ token: apiKey });
        const response = await client.chat({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: `${SANDBOX_CONTEXT}\n\n${roleContext}\n\nYou are a child node processing a specific task. Provide detailed and focused responses. If you believe the task is complete, end your message with "TASK_RESOLVED".`
            },
            {
              role: 'user',
              content: message.content
            }
          ],
          temperature: temperature
        });
        result = response.message.content?.[0]?.text || 'No response from model';
      } else {
        throw new Error('OpenAI integration not implemented yet');
      }

      const isTaskResolved = result.includes('TASK_RESOLVED');

      // Send result back to parent
      const responseMessage: Omit<NodeMessage, 'id' | 'timestamp' | 'status'> = {
        from: id,
        to: parentNodeId || 'unknown',
        content: result,
        type: 'direct',
        metadata: {
          role: 'assistant',
          taskHistory: message.metadata.taskHistory 
            ? `${message.metadata.taskHistory}\n\nNode ${id}: ${result}`
            : `Node ${id}: ${result}`,
          isTaskResolved: isTaskResolved,
          originalRequest: message.metadata.originalRequest || message.content,
          finalResult: isTaskResolved // Mark as final result if task is resolved
        }
      };

      const sentMessage = await nodeCommunication.current.sendMessage(responseMessage);

      // Add to local messages
      const localMessage: Message = {
        id: sentMessage.id,
        from: sentMessage.from,
        to: sentMessage.to,
        role: 'assistant',
        content: sentMessage.content,
        timestamp: sentMessage.timestamp,
        status: sentMessage.status === 'delivered' ? 'delivered' : sentMessage.status === 'failed' ? 'failed' : 'sent'
      };

      // Update shared conversations
      const conversationId = message.from;
      const conversation = sharedConversations.get(conversationId);
      if (conversation) {
        const newConversations = new Map(sharedConversations);
        newConversations.set(conversationId, {
          ...conversation,
          messages: [...conversation.messages, localMessage],
          lastMessage: Date.now()
        });
        setSharedConversations(newConversations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setMessageStats(prev => ({
        ...prev,
        failed: prev.failed + 1
      }));
    }
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        width: 400, 
        height: 600, 
        display: 'flex', 
        flexDirection: 'column',
        border: parentNodeId ? '2px solid #4CAF50' : 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Connection Status Indicator */}
      {parentNodeId && (
        <Box
          sx={{
            position: 'absolute',
            top: -12,
            right: -12,
            backgroundColor: '#4CAF50',
            borderRadius: '50%',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1
          }}
        >
          <Tooltip title={`Connected to ${getActiveAgents().find(a => a.id === parentNodeId)?.name || 'Parent Node'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          </Tooltip>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ 
        p: 1.5, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 0 // Prevents flex items from overflowing
      }}>
        <Typography variant="h6" component="div" sx={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {data.name || 'AI Node'}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 0.5,
          minWidth: 0 // Prevents flex items from overflowing
        }}>
          {isParent && (
            <Chip
              label="Parent Node"
              color="primary"
              size="small"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
            />
          )}
          {parentNodeId && (
            <Chip
              label="Connected"
              color="success"
              size="small"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
              onDelete={() => {
                const event = new CustomEvent('node-disconnect', {
                  detail: { nodeId: id, parentNodeId }
                });
                window.dispatchEvent(event);
              }}
            />
          )}
          <Tooltip title={parentNodeId ? "Connected to parent node" : "Connect to parent node"}>
            <IconButton
              size="small"
              color={parentNodeId ? "success" : "default"}
              onClick={() => {
                if (!parentNodeId) {
                  const event = new CustomEvent('node-connect-request', {
                    detail: { nodeId: id }
                  });
                  window.dispatchEvent(event);
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Tabs 
        value={tabValue} 
        onChange={handleTabChange} 
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          minWidth: 0 // Prevents tabs from overflowing
        }}
      >
        <Tab label="Chat" />
        <Tab label="Settings" />
        <Tab label="Stats" />
      </Tabs>

      <Box sx={{ 
        position: 'relative', 
        height: 'calc(100% - 48px)',
        overflow: 'hidden',
        width: '100%'
      }}>
        <TabPanel value={tabValue} index={0}>
          {/* Chat content */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            p: 1,
            overflow: 'hidden',
            width: '100%'
          }}>
            <Box sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              mb: 1,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '3px',
                '&:hover': {
                  background: '#555',
                },
              },
            }}>
              {(activeConversation 
                ? sharedConversations.get(activeConversation)?.messages || []
                : messages
              )
              .filter((message, index, self) => 
                index === self.findIndex(m => m.id === message.id)
              )
              .map((message, index) => (
                <Box 
                  key={`${message.id}-${index}`} 
                  sx={{ 
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    maxWidth: '90%',
                    ml: message.role === 'assistant' ? 0 : 'auto',
                    mr: message.role === 'assistant' ? 'auto' : 0,
                    bgcolor: message.role === 'assistant' ? 'action.hover' : 'transparent',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {message.from === id ? 
                      `${getActiveAgents().find(a => a.id === id)?.name || 'This Node'}` : 
                      `${getActiveAgents().find(a => a.id === message.from)?.name || 'Agent'} (${message.from})`}
                  </Typography>
                  <Typography variant="body2">
                    {message.content}
                  </Typography>
                  {message.timestamp && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                </Box>
              ))}
              <div ref={chatEndRef} />
            </Box>
            <Box sx={{ 
              display: 'flex', 
              gap: 1,
              p: 1,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              minWidth: 0 // Prevents flex items from overflowing
            }}>
              <TextField
                fullWidth
                size="small"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.875rem',
                  },
                  minWidth: 0 // Prevents text field from overflowing
                }}
              />
              <IconButton 
                color="primary" 
                onClick={handleSendMessage}
                disabled={loading || !inputMessage.trim()}
                sx={{ 
                  minWidth: '40px',
                  height: '40px',
                  flexShrink: 0 // Prevents button from shrinking
                }}
              >
                {loading ? <CircularProgress size={20} /> : <SendIcon />}
              </IconButton>
            </Box>
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {/* Settings content */}
          <Box sx={{ 
            height: '100%', 
            overflow: 'auto',
            p: 1,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '3px',
              '&:hover': {
                background: '#555',
              },
            },
          }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={handleModelClick}
                    sx={{ 
                      minWidth: '200px',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none'
                    }}
                  >
                    {selectedModelData ? `${selectedModelData.provider} - ${selectedModelData.name}` : 'Select Model'}
                  </Button>
                  <Popover
                    open={modelOpen}
                    anchorEl={modelAnchorEl}
                    onClose={handleModelClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                  >
                    <List sx={{ 
                      maxHeight: 400,
                      width: '300px',
                      overflow: 'auto',
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                      },
                    }}>
                      {AVAILABLE_MODELS.map((model) => (
                        <ListItem key={model.id} disablePadding>
                          <ListItemButton 
                            selected={model.id === selectedModel}
                            onClick={() => handleModelSelect(model.id)}
                          >
                            <ListItemText 
                              primary={`${model.provider} - ${model.name}`}
                              secondary={model.description}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Popover>
                </Box>
              </Grid>
              <Grid item xs={12}>
                {/* Role Selection */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Role</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {roleManager.getAvailableRoles().map((role) => (
                      <FormControlLabel
                        key={role.id}
                        control={
                          <Checkbox
                            checked={selectedRole === role.id}
                            onChange={() => handleRoleChange(role.id)}
                            name={role.id}
                            color="primary"
                          />
                        }
                        label={role.name}
                      />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {roleManager.getRole(id)?.description}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>Temperature</Typography>
                <Slider
                  value={temperature}
                  onChange={(_, value) => setTemperature(value as number)}
                  min={0}
                  max={1}
                  step={0.1}
                  marks
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="System Prompt"
                  multiline
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isParent}
                      onChange={handleParentStatusChange}
                    />
                  }
                  label="Parent Node"
                  sx={{ 
                    width: '100%',
                    m: 0,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                />
              </Grid>
              {!isParent && (
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => {
                      const event = new CustomEvent('node-connect-request', {
                        detail: { nodeId: id }
                      });
                      window.dispatchEvent(event);
                    }}
                  >
                    Connect to Parent Node
                  </Button>
                </Grid>
              )}
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={20} /> : 'Save Settings'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {/* Stats content */}
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Message Statistics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    bgcolor: 'success.light',
                    borderRadius: 1
                  }}>
                    <Typography variant="h4" color="success.dark">
                      {messageStats.successful}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      Successful
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    bgcolor: 'error.light',
                    borderRadius: 1
                  }}>
                    <Typography variant="h4" color="error.dark">
                      {messageStats.failed}
                    </Typography>
                    <Typography variant="body2" color="error.dark">
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    bgcolor: 'info.light',
                    borderRadius: 1
                  }}>
                    <Typography variant="h4" color="info.dark">
                      {messageStats.total}
                    </Typography>
                    <Typography variant="body2" color="info.dark">
                      Total
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={messageStats.total > 0 
                        ? (messageStats.successful / messageStats.total) * 100 
                        : 0}
                      size={40}
                      sx={{ color: 'success.main' }}
                    />
                    <Typography variant="h6">
                      {messageStats.total > 0 
                        ? Math.round((messageStats.successful / messageStats.total) * 100) 
                        : 0}%
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Average Response Time
                  </Typography>
                  <Typography variant="h6">
                    {calculateAverageResponseTime(messages)}ms
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Message History
                </Typography>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleResetNode}
                  startIcon={<RefreshIcon />}
                >
                  Reset Node
                </Button>
              </Box>
              <List>
                {data.messages.filter(m => m.role === 'assistant').map((message) => (
                  <ListItem
                    key={message.id}
                    sx={{
                      mb: 1,
                      borderLeft: 4,
                      borderColor: message.status === 'delivered' 
                        ? 'success.main' 
                        : message.status === 'failed'
                        ? 'error.main'
                        : 'warning.main',
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2">
                            {message.from === id ? 
                              `To: Node ${message.to}` : 
                              `From: Node ${message.from}`}
                          </Typography>
                          <Chip
                            size="small"
                            label={message.status}
                            color={
                              message.status === 'delivered' 
                                ? 'success' 
                                : message.status === 'failed'
                                ? 'error'
                                : 'warning'
                            }
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {message.content}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(message.timestamp, 'MM/dd/yyyy HH:mm:ss')}
                          </Typography>
                        </Box>
                      }
                    />
                    {message.status === 'failed' && (
                      <ListItemSecondaryAction>
                        <Tooltip title="Retry sending message">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => {
                              // Implement retry logic here
                            }}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        </TabPanel>
      </Box>

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
};

export default AINode; 