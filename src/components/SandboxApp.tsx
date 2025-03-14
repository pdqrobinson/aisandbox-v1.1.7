import React from 'react';
import { Node, Edge, NodeChange, EdgeChange, Connection, useNodesState, useEdgesState, useReactFlow, addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { useSandboxState } from '../services/SandboxState';
import { AIAgent } from '../services/SandboxState';
import { NodeConnectionDialog } from './NodeConnectionDialog';
import { SandboxCanvas } from './SandboxCanvas';

export function SandboxApp() {
  const { updateAgent, addAgent } = useSandboxState();
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
                connectedNodes: new Set([...node.data.connectedNodes, target]),
                parentNodeId: target
              }
            };
          }
          if (node.id === target) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: new Set([...node.data.connectedNodes, source])
              }
            };
          }
          return node;
        });
      });

      // Update the sandbox state
      updateAgent(source, {
        parentNodeId: target,
        lastSeen: new Date()
      });
    };

    const handleDisconnect = (event: CustomEvent<{ nodeId: string; parentNodeId: string }>) => {
      const { nodeId, parentNodeId } = event.detail;
      
      // Remove the edge
      setEdges((eds) => eds.filter(edge => 
        !(edge.source === nodeId && edge.target === parentNodeId)
      ));

      // Update the nodes
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: new Set([...node.data.connectedNodes].filter(id => id !== parentNodeId)),
                parentNodeId: null
              }
            };
          }
          if (node.id === parentNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                connectedNodes: new Set([...node.data.connectedNodes].filter(id => id !== nodeId))
              }
            };
          }
          return node;
        });
      });

      // Update the sandbox state
      updateAgent(nodeId, {
        parentNodeId: null,
        lastSeen: new Date()
      });
    };

    window.addEventListener('node-connect-request' as any, handleConnectionRequest);
    window.addEventListener('node-connect' as any, handleConnect);
    window.addEventListener('node-disconnect' as any, handleDisconnect);
    
    return () => {
      window.removeEventListener('node-connect-request' as any, handleConnectionRequest);
      window.removeEventListener('node-connect' as any, handleConnect);
      window.removeEventListener('node-disconnect' as any, handleDisconnect);
    };
  }, [setEdges, setNodes, updateAgent]);

  const handleAddAgent = () => {
    const newAgent: AIAgent = {
      id: `agent-${Date.now()}`,
      name: `Agent ${Date.now()}`,
      model: 'command-a-03-2025',
      provider: 'Cohere',
      status: 'active',
      lastSeen: new Date(),
      capabilities: ['text-generation', 'chat'],
      connectedNodes: new Set(),
      isParent: false,
      role: 'worker'
    };

    // Add the agent to the sandbox state
    addAgent(newAgent);
    
    // Calculate a default position based on the number of existing nodes
    const defaultX = 100 + (nodes.length * 50);
    const defaultY = 100 + (nodes.length * 50);
    
    const newNode = {
      id: newAgent.id,
      type: 'aiNode',
      position: { x: defaultX, y: defaultY },
      data: {
        name: newAgent.name,
        model: newAgent.model,
        provider: newAgent.provider,
        connectedNodes: new Set(),
        messages: [],
        role: newAgent.role,
        apiKey: '',
        temperature: 0.7,
        systemPrompt: '',
        isParent: false
      }
    };

    setNodes((nds) => [...nds, newNode]);
  };

  const onConnect = React.useCallback((connection: Connection) => {
    // Prevent self-connections
    if (connection.source === connection.target) {
      return;
    }

    // Get the source and target nodes
    const sourceNode = getNode(connection.source!);
    const targetNode = getNode(connection.target!);

    if (!sourceNode || !targetNode) {
      return;
    }

    // Only allow connections to parent nodes
    if (!targetNode.data.isParent) {
      return;
    }

    // Add the new edge
    setEdges((eds) => addEdge(connection, eds));
    
    // Update connected nodes in the data
    setNodes((nds) => {
      return nds.map((node) => {
        if (node.id === connection.source) {
          return {
            ...node,
            data: {
              ...node.data,
              connectedNodes: new Set([...node.data.connectedNodes, connection.target]),
              parentNodeId: connection.target
            }
          };
        }
        if (node.id === connection.target) {
          return {
            ...node,
            data: {
              ...node.data,
              connectedNodes: new Set([...node.data.connectedNodes, connection.source])
            }
          };
        }
        return node;
      });
    });

    // Update the sandbox state
    updateAgent(connection.source!, {
      parentNodeId: connection.target!,
      lastSeen: new Date()
    });
  }, [setEdges, setNodes, getNode, updateAgent]);

  const handleResetSandbox = () => {
    setNodes([]);
    setEdges([]);
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
      />
      {selectedNodeId && (
        <NodeConnectionDialog
          open={connectionDialogOpen}
          onClose={() => setConnectionDialogOpen(false)}
          sourceNodeId={selectedNodeId}
        />
      )}
    </>
  );
} 