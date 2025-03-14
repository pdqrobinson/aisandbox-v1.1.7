import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Connection,
  Edge,
  NodeTypes,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Paper, Stack, Tooltip, Button } from '@mui/material';
import {
  NoteAdd as NotesIcon,
  Chat as ChatIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Link as UrlIcon,
  AutoFixHigh as ImageGenerationIcon,
} from '@mui/icons-material';
import { useCanvasStore } from '../store/canvasStore';
import { NodeType } from '../types/nodes';
import { ChatNode } from './nodes/ChatNode';
import { NotesNode } from './nodes/NotesNode';
import { ImageNode } from './nodes/ImageNode';
import { DocumentNode } from './nodes/DocumentNode';
import { UrlNode } from './nodes/UrlNode';
import { ImageGenerationNode } from './nodes/ImageGenerationNode';

// Define nodeTypes outside of the component
const NODE_TYPES = {
  chat: ChatNode,
  notes: NotesNode,
  image: ImageNode,
  document: DocumentNode,
  url: UrlNode,
  imageGeneration: ImageGenerationNode,
} as const;

// Memoize actions
const useActions = () => useMemo(() => [
  { icon: <ChatIcon />, name: 'Chat Node', type: 'chat' as NodeType },
  { icon: <NotesIcon />, name: 'Notes Node', type: 'notes' as NodeType },
  { icon: <ImageIcon />, name: 'Image Node', type: 'image' as NodeType },
  { icon: <DocumentIcon />, name: 'Document Node', type: 'document' as NodeType },
  { icon: <UrlIcon />, name: 'URL Node', type: 'url' as NodeType },
  { icon: <ImageGenerationIcon />, name: 'Image Generation', type: 'imageGeneration' as NodeType },
], []);

export const Canvas: React.FC = () => {
  const { nodes, edges, addNode, addEdge, updateNode } = useCanvasStore();
  const actions = useActions();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      
      // Update node positions in store
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            updateNode(change.id, {
              ...node.data,
              position: change.position,
            });
          }
        }
      });

      useCanvasStore.setState({ nodes: updatedNodes });
    },
    [nodes, updateNode]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      useCanvasStore.setState({ edges: updatedEdges });
    },
    [edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      addEdge(connection);
    },
    [addEdge]
  );

  const handleAddNode = useCallback((type: NodeType) => {
    const position = {
      x: window.innerWidth / 2 - 100,
      y: window.innerHeight / 2 - 100,
    };
    addNode(type, position);
  }, [addNode]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: 'background.default',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          fitView
          attributionPosition="bottom-right"
          snapToGrid={true}
          snapGrid={[15, 15]}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={4}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Control', 'Meta']}
          selectionKeyCode={['Shift']}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </Paper>

      <Stack
        direction="column"
        spacing={1}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        {actions.map((action) => (
          <Tooltip key={action.type} title={action.name} placement="left">
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleAddNode(action.type)}
              startIcon={action.icon}
              sx={{
                minWidth: '160px',
                justifyContent: 'flex-start',
                textAlign: 'left',
              }}
            >
              {action.name}
            </Button>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}; 