import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Send as SendIcon, Monitor as MonitorIcon } from '@mui/icons-material';
import { messageBus, EventMessage, EventType } from '../services/MessageBus';
import { format } from 'date-fns';

interface LogEntry {
  timestamp: number;
  type: EventType;
  content: string;
  senderId: string;
  receiverId?: string;
}

export const MainChat: React.FC = () => {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to all messages using a main-chat node ID
    const mainChatId = 'main-chat';
    const handleMessage = (message: EventMessage) => {
      const logEntry: LogEntry = {
        timestamp: Date.now(),
        type: message.eventType,
        content: message.content,
        senderId: message.senderId,
        receiverId: message.receiverId
      };
      setLogs(prev => [...prev, logEntry]);
      
      // Update active nodes
      setActiveNodes(prev => new Set([...prev, message.senderId]));
    };

    messageBus.subscribe(mainChatId, handleMessage);

    return () => {
      messageBus.unsubscribe(mainChatId, handleMessage);
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = () => {
    if (!input.trim()) return;

    messageBus.broadcastControl(input, {
      source: 'main-chat',
      timestamp: Date.now()
    });

    setInput('');
  };

  const getEventColor = (type: EventType): string => {
    const colors: Record<EventType, string> = {
      message: '#2196f3',
      task: '#4caf50',
      status: '#ff9800',
      capability: '#9c27b0',
      control: '#f44336',
      context_updated: '#795548'
    };
    return colors[type] || '#757575';
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MonitorIcon /> Main Control Panel
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Array.from(activeNodes).map(node => (
            <Chip
              key={node}
              label={node}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <List>
          {logs.map((log, index) => (
            <React.Fragment key={index}>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={log.type}
                        size="small"
                        sx={{ backgroundColor: getEventColor(log.type), color: 'white' }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {format(log.timestamp, 'HH:mm:ss')}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" component="span" color="textSecondary">
                        {log.senderId} {log.receiverId ? `→ ${log.receiverId}` : '(broadcast)'}
                      </Typography>
                      <Typography variant="body1" component="p">
                        {log.content}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
              <Divider variant="inset" component="li" />
            </React.Fragment>
          ))}
          <div ref={logsEndRef} />
        </List>
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Enter control command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
          />
          <Tooltip title="Send command">
            <span>
              <IconButton 
                color="primary" 
                onClick={handleSendCommand}
                disabled={!input.trim()}
              >
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}; 