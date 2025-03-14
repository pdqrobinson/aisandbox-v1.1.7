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
import { Box, Button, Typography } from '@mui/material';
import AINode from './AINode';
import { useSandboxState } from '../services/SandboxState';

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
    <Box sx={{ width: '100vw', height: '100vh' }}>
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
        <Panel position="top-left">
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" onClick={onAddAgent}>
              Add Agent
            </Button>
            <Button variant="outlined" onClick={onResetSandbox}>
              Reset Sandbox
            </Button>
          </Box>
        </Panel>
      </ReactFlow>
    </Box>
  );
} 