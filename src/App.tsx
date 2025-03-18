import React from 'react';
import { ThemeProvider } from '@mui/material';
import theme from './theme';
import { SandboxProvider } from './contexts/SandboxContext';
import { MainLayout } from './components/Layout/MainLayout';
import { ReactFlowProvider } from 'reactflow';
import './styles/resizable.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ReactFlowProvider>
        <SandboxProvider>
          <MainLayout />
        </SandboxProvider>
      </ReactFlowProvider>
    </ThemeProvider>
  );
}

export default App; 