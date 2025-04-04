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
import { MessageType } from '../types/sandbox';
import { format } from 'date-fns';

interface LogEntry extends Omit<EventMessage, 'eventType'> {
  eventType: EventType;
}

const MAIN_CHAT_ID = 'main-chat';

// Define all event types we want to listen to
const ALL_EVENT_TYPES: EventType[] = ['message', 'task', 'status', 'capability', 'control', 'context_updated'];

export const MainChat: React.FC = () => {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (message: EventMessage) => {
      // Convert EventMessage to LogEntry
      const logEntry: LogEntry = {
        ...message,
        timestamp: message.timestamp
      };
      
      setLogs(prev => [...prev, logEntry]);
      
      // Update active nodes
      if (message.senderId !== MAIN_CHAT_ID) {
        setActiveNodes(prev => new Set([...prev, message.senderId]));
      }
    };

    // Subscribe to all event types
    const unsubscribe = messageBus.subscribe(MAIN_CHAT_ID, ALL_EVENT_TYPES, handleMessage);

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = () => {
    if (!input.trim()) return;

    // Create the message
    const message = {
      id: `main-chat-${Date.now()}`,
      senderId: MAIN_CHAT_ID,
      receiverId: 'all',
      from: MAIN_CHAT_ID,
      to: 'all',
      content: input,
      type: 'text' as MessageType,
      timestamp: new Date(),
      status: 'sent' as const,
      metadata: {
        source: 'main-chat',
        timestamp: Date.now(),
        isCommand: true
      }
    };

    // Emit the message
    const sentMessage = messageBus.emit('message', message);

    // Add our sent message to the logs
    setLogs(prev => [...prev, {
      ...sentMessage,
      eventType: 'message'
    }]);

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
                        label={log.eventType}
                        size="small"
                        sx={{ backgroundColor: getEventColor(log.eventType), color: 'white' }}
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