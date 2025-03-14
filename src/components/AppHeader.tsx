import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, WifiOff as WifiOffIcon, Wifi as WifiIcon } from '@mui/icons-material';
import { useSandboxState } from '../services/SandboxState';

export function AppHeader() {
  const { getActiveAgents } = useSandboxState();
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

  const activeAgents = getActiveAgents();

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
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AI Sandbox
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<WifiIcon />}
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