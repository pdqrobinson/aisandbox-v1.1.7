import React from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import ReactFlow, { 
  Node, 
  Edge, 
  NodeChange,
  EdgeChange,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useSandboxState } from './services/SandboxState';
import AINode from './components/AINode';
import { NodeConnectionDialog } from './components/NodeConnectionDialog';
import { SandboxCanvas } from './components/SandboxCanvas';
import { Agent } from './types/sandbox';
import { AIAgent } from './services/SandboxState';
import { SandboxProvider } from './contexts/SandboxContext';
import { SandboxApp } from './components/SandboxApp';
import { AppHeader } from './components/AppHeader';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const nodeTypes = {
  aiNode: AINode,
};

function App() {
  return (
    <ReactFlowProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SandboxProvider>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <AppHeader />
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <SandboxApp />
            </Box>
          </Box>
        </SandboxProvider>
      </ThemeProvider>
    </ReactFlowProvider>
  );
}

export default App; 