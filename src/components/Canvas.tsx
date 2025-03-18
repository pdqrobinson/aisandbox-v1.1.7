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

const NODE_TYPES = {
  chatNode: ChatNode,
  notesNode: NotesNode,
  urlNode: UrlNode,
  documentNode: DocumentNode,
};

const ACTIONS = [
  {
    type: 'chatNode',
    name: 'Add Chat Node',
    icon: <ChatIcon />,
  },
  {
    type: 'notesNode',
    name: 'Add Notes Node',
    icon: <NotesIcon />,
  },
  {
    type: 'urlNode',
    name: 'Add URL Node',
    icon: <UrlIcon />,
  },
  {
    type: 'documentNode',
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
      // Ensure we have both source and target
      if (params.source && params.target) {
        // Check if connection already exists
        const connectionExists = edges.some(
          edge => 
            (edge.source === params.source && edge.target === params.target) ||
            (edge.source === params.target && edge.target === params.source)
        );

        if (!connectionExists) {
          const edge: Edge = {
            id: `${params.source}-${params.target}`,
            source: params.source,
            target: params.target,
            type: 'default',
            animated: false,
            style: { stroke: '#555' }
          };
          setEdges((eds) => [...eds, edge]);
          onConnect(edge);
        }
      }
    },
    [edges, setEdges, onConnect]
  );

  const handleAddNode = React.useCallback(
    (type: string) => {
      const viewport = getViewport();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Calculate position in flow coordinates
      const position = {
        x: (centerX - viewport.x) / viewport.zoom,
        y: (centerY - viewport.y) / viewport.zoom,
      };

      // Snap to grid
      const snappedPosition = {
        x: Math.round(position.x / 15) * 15,
        y: Math.round(position.y / 15) * 15,
      };

      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position: snappedPosition,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1, -4)} ${nodes.length + 1}`,
          type,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      addNode(newNode);
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