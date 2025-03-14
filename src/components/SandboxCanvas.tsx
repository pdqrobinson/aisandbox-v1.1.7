import React from 'react';
import ReactFlow, { 
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  Node,
  Edge,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Button, Paper, Stack } from '@mui/material';
import AINode from './AINode';
import { useSandboxState } from '../services/SandboxState';
import { AppHeader } from './AppHeader';

const nodeTypes = {
  aiNode: AINode,
};

interface SandboxCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onAddAgent: () => void;
  onResetSandbox: () => void;
}

export function SandboxCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddAgent,
  onResetSandbox
}: SandboxCanvasProps) {
  const { getNode } = useReactFlow();

  return (
    <Stack sx={{ width: '100vw', height: '100vh' }}>
      {/* App Header */}
      <AppHeader />
      
      {/* Main Content */}
      <Box sx={{ position: 'relative', flexGrow: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        
        {/* Control Panel */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 5,
            padding: 2,
            backgroundColor: 'background.paper',
            borderRadius: 1
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="contained" 
              onClick={onAddAgent}
              sx={{
                backgroundColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                minWidth: '120px'
              }}
            >
              Add Agent
            </Button>
            <Button 
              variant="outlined" 
              onClick={onResetSandbox}
              sx={{ minWidth: '120px' }}
            >
              Reset Sandbox
            </Button>
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
} 