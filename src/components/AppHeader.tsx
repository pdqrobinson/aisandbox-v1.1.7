import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, WifiOff as WifiOffIcon, Wifi as WifiIcon, Hub as HubIcon } from '@mui/icons-material';
import { useSandbox } from '../contexts/SandboxContext';

export function AppHeader() {
  const { state, dispatch } = useSandbox();
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = React.useState<number | null>(null);

  const checkConnection = React.useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3002/api/cohere/health');
      const data = await response.json();
      setIsConnected(data.status === 'ok');
    } catch (error) {
      setIsConnected(false);
    }
    setLastCheckedTimestamp(Date.now());
  }, []);

  React.useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkConnection]);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleRefresh = () => {
    dispatch({ type: 'RESET_SANDBOX' });
  };

  const activeAgents = state.agents.filter(agent => agent.status === 'active');

  return (
    <AppBar 
      position="relative" 
      color="default" 
      elevation={1}
      sx={{ 
        zIndex: 10,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Toolbar sx={{ minHeight: 64 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HubIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" component="div">
            AI Sandbox
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
          <Chip
            icon={<HubIcon />}
            label={`${activeAgents.length} Active Agents`}
            color="primary"
            variant="outlined"
            size="small"
          />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              size="small"
            />
            <Tooltip title="Check Server Connection">
              <IconButton 
                size="small" 
                onClick={checkConnection}
                color={isConnected ? 'success' : 'error'}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Tooltip title="Reset Sandbox">
            <IconButton 
              size="small"
              onClick={handleRefresh}
              color="primary"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {lastCheckedTimestamp && (
            <Typography variant="caption" color="text.secondary">
              Last checked: {formatTimestamp(lastCheckedTimestamp)}
            </Typography>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
} 