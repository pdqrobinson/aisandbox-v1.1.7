import React from 'react';
import { ThemeProvider } from '@mui/material';
import theme from './theme';
import { SandboxProvider } from './contexts/SandboxContext';
import { MainLayout } from './components/Layout/MainLayout';
import './styles/resizable.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <SandboxProvider>
        <MainLayout />
      </SandboxProvider>
    </ThemeProvider>
  );
}

export default App; 