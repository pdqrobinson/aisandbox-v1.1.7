import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, Circle as CircleIcon } from '@mui/icons-material';
import { useCanvasStore } from '../../store/canvasStore';

export const HeaderStatus: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const nodes = useCanvasStore((state) => state.nodes);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Count nodes by type
  const nodeTypes = nodes.reduce((acc, node) => {
    const type = node.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Node count */}
      <Tooltip title="Total nodes">
        <Chip
          label={`Nodes: ${nodes.length}`}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Tooltip>

      {/* Node types */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {Object.entries(nodeTypes).map(([type, count]) => (
          <Tooltip key={type} title={`${type} nodes`}>
            <Chip
              label={`${type}: ${count}`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Tooltip>
        ))}
      </Box>

      {/* Connection status */}
      <Tooltip title={isConnected ? "Connected" : "Disconnected"}>
        <Chip
          icon={<CircleIcon sx={{ fontSize: 12 }} />}
          label={isConnected ? "Connected" : "Disconnected"}
          size="small"
          color={isConnected ? "success" : "error"}
          variant="outlined"
        />
      </Tooltip>

      {/* Time */}
      <Tooltip title="Current time">
        <Typography variant="body2" color="text.secondary">
          {currentTime.toLocaleTimeString()}
        </Typography>
      </Tooltip>

      {/* Refresh button */}
      <Tooltip title="Refresh sandbox">
        <IconButton size="small" onClick={handleRefresh} color="inherit">
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}; 