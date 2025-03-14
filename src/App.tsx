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
import { MainChat } from './components/MainChat';
import { DataInputNode } from './components/DataInputNode';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

const nodeTypes = {
  aiNode: AINode,
  dataInput: DataInputNode
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ReactFlowProvider>
        <SandboxProvider>
          <Box sx={{ 
            height: '100vh', 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.default'
          }}>
            <AppHeader />
            <Box sx={{ 
              flex: 1,
              display: 'grid', 
              gridTemplateColumns: '1fr 350px',
              overflow: 'hidden',
            }}>
              <SandboxApp />
              <Box sx={{ 
                borderLeft: 1, 
                borderColor: 'divider',
                height: '100%',
                overflow: 'hidden',
                bgcolor: 'background.paper'
              }}>
                <MainChat />
              </Box>
            </Box>
          </Box>
        </SandboxProvider>
      </ReactFlowProvider>
    </ThemeProvider>
  );
}

export default App; 