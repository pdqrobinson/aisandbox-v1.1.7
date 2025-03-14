import React from 'react';
import { Node, Edge, NodeChange, EdgeChange, Connection, useNodesState, useEdgesState, useReactFlow, addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { useSandbox } from '../contexts/SandboxContext';
import { NodeConnectionDialog } from './NodeConnectionDialog';
import { SandboxCanvas } from './SandboxCanvas';
import { Agent, AgentPersonality, DataInputNode } from '../types/sandbox';
import { getPersonalityConfig } from '../services/PersonalityService';

export interface NodeConnectionDialogProps {
  nodeId: string;
  open: boolean;
  onClose: () => void;
}

export function SandboxApp() {
  const { state, dispatch } = useSandbox();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false);
  const { getNode } = useReactFlow();

  // Handle node changes
  const handleNodesChange = React.useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  // Handle edge changes
  const handleEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  // Add effect to listen for connection requests
  React.useEffect(() => {
    const handleConnectionRequest = (event: CustomEvent<{ nodeId: string }>) => {
      setSelectedNodeId(event.detail.nodeId);
      setConnectionDialogOpen(true);
    };

    const handleConnect = (event: CustomEvent<{ source: string; target: string }>) => {
      const { source, target } = event.detail;
      
      // Create the connection
      const connection: Edge = {
        id: `${source}-${target}`,
        source,
        target,
        type: 'smoothstep',
        animated: true
      };

      // Add the new edge
      setEdges((eds) => addEdge(connection, eds));
      
      // Update connected nodes in the data
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === source) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: [...(node.data.connectedNodes || []), target],
                parentNodeId: target
              }
            };
          }
          if (node.id === target) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: [...(node.data.connectedNodes || []), source]
              }
            };
          }
          return node;
        });
      });

      // Update the agent in context
      const sourceAgent = state.agents.find(a => a.id === source);
      if (sourceAgent) {
        dispatch({
          type: 'UPDATE_AGENT',
          payload: {
            ...sourceAgent,
            parentNodeId: target,
            connectedNodes: [...(sourceAgent.connectedNodes || []), target]
          }
        });
      }
    };

    const handleDisconnect = (event: CustomEvent<{ nodeId: string; parentNodeId: string }>) => {
      const { nodeId, parentNodeId } = event.detail;
      
      setEdges((eds) => eds.filter(edge => 
        !(edge.source === nodeId && edge.target === parentNodeId)
      ));

      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: (node.data.connectedNodes || []).filter((id: string) => id !== parentNodeId),
                parentNodeId: null
              }
            };
          }
          if (node.id === parentNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: (node.data.connectedNodes || []).filter((id: string) => id !== nodeId)
              }
            };
          }
          return node;
        });
      });

      const agent = state.agents.find(a => a.id === nodeId);
      if (agent) {
        dispatch({
          type: 'UPDATE_AGENT',
          payload: {
            ...agent,
            parentNodeId: null,
            connectedNodes: (agent.connectedNodes || []).filter(id => id !== parentNodeId)
          }
        });
      }
    };

    window.addEventListener('node-connect-request' as any, handleConnectionRequest);
    window.addEventListener('node-connect' as any, handleConnect);
    window.addEventListener('node-disconnect' as any, handleDisconnect);
    
    return () => {
      window.removeEventListener('node-connect-request' as any, handleConnectionRequest);
      window.removeEventListener('node-connect' as any, handleConnect);
      window.removeEventListener('node-disconnect' as any, handleDisconnect);
    };
  }, [setEdges, setNodes, state.agents, dispatch]);

  const handleAddAgent = () => {
    // Generate a unique ID for the new agent
    const newAgentId = `agent-${Date.now()}`;
    
    // Select a random personality type
    const personalities: AgentPersonality[] = ['mentor', 'inventor', 'sassy', 'empathic', 'analyst'];
    const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    const personalityConfig = getPersonalityConfig(randomPersonality);
    
    const newAgent: Agent = {
      id: newAgentId,
      name: `${personalityConfig.name} ${nodes.length + 1}`,
      type: 'ai',
      model: 'command-a-03-2025',
      provider: 'Cohere',
      status: 'active',
      lastSeen: new Date(),
      capabilities: ['text-generation', 'chat'],
      connectedNodes: [],
      isParent: false,
      role: 'worker',
      personality: personalityConfig,
      systemPrompt: personalityConfig.systemPrompt,
      temperature: personalityConfig.type === 'inventor' ? 0.9 : 
                  personalityConfig.type === 'sassy' ? 0.8 :
                  personalityConfig.type === 'empathic' ? 0.7 :
                  personalityConfig.type === 'analyst' ? 0.3 : 0.7
    };

    // Add the agent to context
    dispatch({
      type: 'ADD_AGENT',
      payload: newAgent
    });
    
    // Calculate a position that's offset from existing nodes
    const defaultX = 100 + (nodes.length * 150);
    const defaultY = 100 + (nodes.length * 100);
    
    const newNode = {
      id: newAgentId,
      type: 'aiNode',
      position: { x: defaultX, y: defaultY },
      data: {
        ...newAgent,
        messages: [],
        apiKey: '',
      }
    };

    setNodes((nds) => [...nds, newNode]);
  };

  const onConnect = React.useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }

    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);

    if (!sourceNode || !targetNode || !targetNode.data.isParent) {
      return;
    }

    setEdges((eds) => addEdge(connection, eds));
    
    setNodes((nds) => {
      return nds.map((node) => {
        if (node.id === connection.source) {
          return {
            ...node,
            data: {
              ...node.data,
              connectedNodes: [...(node.data.connectedNodes || []), connection.target],
              parentNodeId: connection.target
            }
          };
        }
        if (node.id === connection.target) {
          return {
            ...node,
            data: {
              ...node.data,
              connectedNodes: [...(node.data.connectedNodes || []), connection.source]
            }
          };
        }
        return node;
      });
    });

    const sourceAgent = state.agents.find(a => a.id === connection.source);
    if (sourceAgent) {
      dispatch({
        type: 'UPDATE_AGENT',
        payload: {
          ...sourceAgent,
          parentNodeId: connection.target,
          connectedNodes: [...(sourceAgent.connectedNodes || []), connection.target]
        }
      });
    }
  }, [setEdges, setNodes, getNode, state.agents, dispatch]);

  const handleResetSandbox = () => {
    setNodes([]);
    setEdges([]);
    dispatch({ type: 'RESET_SANDBOX' });
  };

  const handleAddDataInput = () => {
    const newNodeId = `data-input-${Date.now()}`;
    
    const newDataInput: DataInputNode = {
      id: newNodeId,
      name: `Data Input ${nodes.length + 1}`,
      type: 'dataInput' as const,
      contents: [],
      connectedAgents: [],
      status: 'idle',
      lastUpdated: new Date()
    };

    // Add the data input to context
    dispatch({
      type: 'ADD_DATA_INPUT',
      payload: newDataInput
    });
    
    // Calculate a position that's offset from existing nodes
    const defaultX = 100 + (nodes.length * 150);
    const defaultY = 100 + (nodes.length * 100);
    
    const newNode = {
      id: newNodeId,
      type: 'dataInput',
      position: { x: defaultX, y: defaultY },
      data: newDataInput
    };

    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <>
      <SandboxCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onAddAgent={handleAddAgent}
        onResetSandbox={handleResetSandbox}
        onAddDataInput={handleAddDataInput}
      />
      {selectedNodeId && connectionDialogOpen && (
        <NodeConnectionDialog
          nodeId={selectedNodeId}
          open={connectionDialogOpen}
          onClose={() => setConnectionDialogOpen(false)}
        />
      )}
    </>
  );
} 