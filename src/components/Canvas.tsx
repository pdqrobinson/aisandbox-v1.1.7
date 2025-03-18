import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import { Box, Paper, Stack, Button, Tooltip } from '@mui/material';
import { ChatBubble as ChatIcon, Notes as NotesIcon, Language as UrlIcon, Article as DocumentIcon } from '@mui/icons-material';
import { useCanvasStore } from '../store/canvasStore';
import { ChatNode } from './nodes/ChatNode';
import { NotesNode } from './nodes/NotesNode';
import { UrlNode } from './nodes/UrlNode';
import { DocumentNode } from './nodes/DocumentNode';
import { NodeData } from '../types/nodes';
import 'reactflow/dist/style.css';
import { messageBus } from '../services/MessageBus';
import { nodeMessageService } from '../services/NodeMessageService';
import { NodeCommunicationService } from '../services/NodeCommunicationService';

const NODE_TYPES = {
  chat: ChatNode,
  notes: NotesNode,
  url: UrlNode,
  document: DocumentNode,
};

const ACTIONS = [
  {
    type: 'chat',
    name: 'Add Chat Node',
    icon: <ChatIcon />,
  },
  {
    type: 'notes',
    name: 'Add Notes Node',
    icon: <NotesIcon />,
  },
  {
    type: 'url',
    name: 'Add URL Node',
    icon: <UrlIcon />,
  },
  {
    type: 'document',
    name: 'Add Document Node',
    icon: <DocumentIcon />,
  },
];

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const CanvasContent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { project, getViewport } = useReactFlow();
  const addNode = useCanvasStore((state) => state.addNode);
  const onConnect = useCanvasStore((state) => state.onConnect);

  const handleConnect = React.useCallback(
    (params: Connection) => {
      console.log('Canvas: Handle connect called with params:', params);
      console.log('Canvas: All nodes:', nodes);
      console.log('Canvas: Current edges:', edges);
      
      try {
        if (params.source && params.target) {
          const sourceNode = nodes.find(n => n.id === params.source);
          const targetNode = nodes.find(n => n.id === params.target);
          
          console.log('Canvas: Source node:', sourceNode);
          console.log('Canvas: Target node:', targetNode);
          
          if (!sourceNode || !targetNode) {
            console.error('Canvas: Could not find source or target node');
            return;
          }

          // Add edge to the canvas
          const newEdge = {
            id: `${params.source}-${params.target}`,
            source: params.source,
            target: params.target,
            type: 'default'
          };
          
          console.log('Canvas: Creating new edge:', newEdge);
          setEdges(eds => [...eds, newEdge]);
          
          // Create a connection event with source and target info
          const connectionEvent = {
            source: params.source,
            target: params.target,
            sourceType: sourceNode.type,
            targetType: targetNode.type
          };
          
          console.log('Canvas: Created connection event:', connectionEvent);
          
          // Use the NodeCommunicationService to emit the connection event
          const nodeCommunicationService = NodeCommunicationService.getInstance();
          console.log('Canvas: Using NodeCommunicationService:', nodeCommunicationService);
          
          try {
            nodeCommunicationService.sendMessage('connect', {
              senderId: 'canvas',
              type: 'connect',
              content: '',
              metadata: {
                source: params.source,
                target: params.target,
                sourceType: sourceNode.type,
                targetType: targetNode.type
              }
            }).catch(err => {
              console.error('Canvas: Error sending connection event via NodeCommunicationService:', err);
            });
            console.log('Canvas: Successfully sent connection message with NodeCommunicationService');
          } catch (error) {
            console.error('Canvas: Error using NodeCommunicationService:', error);
          }
          
          // Also inform both nodes directly via messageBus for backwards compatibility
          try {
            console.log('Canvas: Attempting to emit connect event via messageBus');
            
            // Send a general connection event
            messageBus.emit('connect', {
              source: params.source,
              target: params.target,
              sourceType: sourceNode.type,
              targetType: targetNode.type,
              metadata: {
                source: params.source,
                target: params.target
              }
            });
            
            // Send direct connect messages to both nodes
            // From source to target
            messageBus.emit('connect', {
              senderId: params.source,
              receiverId: params.target,
              type: 'connect',
              content: `Connection from ${sourceNode.type} to ${targetNode.type}`,
              metadata: {
                source: params.source,
                target: params.target,
                sourceType: sourceNode.type,
                targetType: targetNode.type
              }
            });
            
            // From target to source
            messageBus.emit('connect', {
              senderId: params.target, 
              receiverId: params.source,
              type: 'connect',
              content: `Connection from ${targetNode.type} to ${sourceNode.type}`,
              metadata: {
                source: params.target,
                target: params.source,
                sourceType: targetNode.type,
                targetType: sourceNode.type
              }
            });
            
            // One more broadcast in each direction
            setTimeout(() => {
              console.log('Canvas: Sending delayed connection confirmation...');
              messageBus.emit('request', {
                senderId: params.source,
                receiverId: params.target,
                type: 'connection_check',
                content: 'Checking connection status',
                metadata: {
                  type: 'connection_check'
                }
              });
              
              messageBus.emit('request', {
                senderId: params.target,
                receiverId: params.source,
                type: 'connection_check',
                content: 'Checking connection status',
                metadata: {
                  type: 'connection_check'
                }
              });
            }, 500);
            
            console.log('Canvas: Successfully emitted connect events via messageBus');
          } catch (error) {
            console.error('Canvas: Error using messageBus:', error);
          }
          
          // Also tell the store
          console.log('Canvas: Calling onConnect from store');
          onConnect(connectionEvent);
          console.log('Canvas: Connection process complete');
        }
      } catch (error) {
        console.error('Canvas: Unexpected error in handleConnect:', error);
      }
    },
    [nodes, setEdges, onConnect, edges]
  );

  const handleAddNode = React.useCallback(
    (type: string) => {
      console.log('Canvas: Adding new node of type:', type);
      const viewport = getViewport();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const position = {
        x: (centerX - viewport.x) / viewport.zoom,
        y: (centerY - viewport.y) / viewport.zoom,
      };

      const snappedPosition = {
        x: Math.round(position.x / 15) * 15,
        y: Math.round(position.y / 15) * 15,
      };

      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position: snappedPosition,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodes.length + 1}`,
          type: type
        },
      };

      console.log('Canvas: Created new node:', newNode);
      setNodes((nds) => [...nds, newNode]);
      addNode(type, snappedPosition, newNode.data);
    },
    [nodes.length, addNode, getViewport, setNodes]
  );

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={NODE_TYPES}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode="Delete"
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
        connectionMode="loose"
      >
        <Background />
        <Controls />
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1} p={1}>
            {ACTIONS.map((action) => (
              <Tooltip key={action.type} title={action.name}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddNode(action.type)}
                  startIcon={action.icon}
                >
                  {action.name}
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </Paper>
      </ReactFlow>
    </Box>
  );
};

export const Canvas = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
); 