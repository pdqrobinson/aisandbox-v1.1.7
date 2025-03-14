import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, WifiOff as WifiOffIcon, Wifi as WifiIcon } from '@mui/icons-material';
import { useSandboxState } from '../services/SandboxState';

export function AppHeader() {
  const { getActiveAgents } = useSandboxState();
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  const checkConnection = React.useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3002/api/cohere/health');
      const data = await response.json();
      setIsConnected(data.status === 'ok');
    } catch (error) {
      setIsConnected(false);
    }
    setLastChecked(new Date());
  }, []);

  React.useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkConnection]);

  const activeAgents = getActiveAgents();

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
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
            <Tooltip title="Check Connection">
              <IconButton size="small" onClick={checkConnection}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
} 