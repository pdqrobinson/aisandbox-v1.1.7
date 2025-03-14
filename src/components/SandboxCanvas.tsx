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
import { Box, Button, Paper, Stack, ButtonGroup } from '@mui/material';
import AINode from './AINode';
import { useSandboxState } from '../services/SandboxState';
import { Add as AddIcon, DataObject as DataIcon } from '@mui/icons-material';

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
  onAddDataInput?: () => void;
}

export function SandboxCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddAgent,
  onResetSandbox,
  onAddDataInput
}: SandboxCanvasProps) {
  const { getNode } = useReactFlow();

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%',
      height: '100%',
      flex: 1,
      display: 'flex'
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        style={{ width: '100%', height: '100%' }}
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
          <ButtonGroup orientation="vertical">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddAgent}
            >
              Add Agent
            </Button>
            {onAddDataInput && (
              <Button
                variant="contained"
                startIcon={<DataIcon />}
                onClick={onAddDataInput}
              >
                Add Data Input
              </Button>
            )}
          </ButtonGroup>
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
  );
} 