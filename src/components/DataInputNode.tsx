import React, { useState, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Upload as UploadIcon,
  Link as LinkIcon,
  TextFields as TextIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Hub as HubIcon
} from '@mui/icons-material';
import { Handle, Position } from 'reactflow';
import { useSandbox } from '../contexts/SandboxContext';
import { DataInputNode as DataInputNodeType, DataInputContent, DataInputType } from '../types/sandbox';
import { messageBus } from '../services/MessageBus';

interface DataInputNodeProps {
  id: string;
  data: DataInputNodeType;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`input-tabpanel-${index}`}
      aria-labelledby={`input-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export function DataInputNode({ id, data }: DataInputNodeProps) {
  const { dispatch } = useSandbox();
  const [tabValue, setTabValue] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const processContent = async (type: DataInputType, content: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      let processedContent: DataInputContent = {
        id: `content-${Date.now()}`,
        type,
        content,
        metadata: {
          timestamp: new Date(),
          source: type === 'url' ? content : 'manual input'
        }
      };

      if (type === 'url') {
        // Fetch and process URL content
        const response = await fetch(content);
        const html = await response.text();
        // Simple HTML text extraction (you might want to use a proper HTML parser)
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        processedContent.processed = {
          text,
          summary: text.substring(0, 200) + '...' // Simple summary
        };
      } else {
        processedContent.processed = {
          text: content,
          summary: content.substring(0, 200) + '...' // Simple summary
        };
      }

      // Update node data
      dispatch({
        type: 'UPDATE_DATA_INPUT',
        payload: {
          ...data,
          contents: [...data.contents, processedContent],
          lastUpdated: new Date(),
          status: 'idle'
        }
      });
      // Emit context updated event
      messageBus.emit('context_updated', {
        id: `msg-${Date.now()}`,
        senderId: id,
        type: 'context_updated',
        content: JSON.stringify(processedContent),
        timestamp: new Date()
      });

      // Clear input
      if (type === 'text') setTextInput('');
      if (type === 'url') setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process content');
      dispatch({
        type: 'UPDATE_DATA_INPUT',
        payload: {
          ...data,
          status: 'error',
          lastUpdated: new Date()
        }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const processedContent: DataInputContent = {
          id: `content-${Date.now()}`,
          type: 'document',
          content: content,
          metadata: {
            title: file.name,
            mimeType: file.type,
            size: file.size,
            timestamp: new Date()
          },
          processed: {
            text: content,
            summary: content.substring(0, 200) + '...' // Simple summary
          }
        };

        dispatch({
          type: 'UPDATE_DATA_INPUT',
          payload: {
            ...data,
            contents: [...data.contents, processedContent],
            lastUpdated: new Date(),
            status: 'idle'
          }
        });

        messageBus.emit('context_updated', {
          id: `msg-${Date.now()}`,
          senderId: id,
          type: 'context_updated',
          content: JSON.stringify(processedContent),
          timestamp: new Date()
        });
      };

      reader.readAsText(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      dispatch({
        type: 'UPDATE_DATA_INPUT',
        payload: {
          ...data,
          status: 'error',
          lastUpdated: new Date()
        }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteContent = (contentId: string) => {
    dispatch({
      type: 'UPDATE_DATA_INPUT',
      payload: {
        ...data,
        contents: data.contents.filter(c => c.id !== contentId),
        lastUpdated: new Date()
      }
    });
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        width: 350,
        height: 500,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <Handle type="source" position={Position.Right} />
      
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <HubIcon color="primary" />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {data.name}
        </Typography>
        <Chip
          size="small"
          label={`${data.contents.length} inputs`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Tabs */}
      <Tabs 
        value={tabValue} 
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Text" icon={<TextIcon />} />
        <Tab label="URL" icon={<LinkIcon />} />
        <Tab label="File" icon={<UploadIcon />} />
      </Tabs>

      {/* Text Input Panel */}
      <TabPanel value={tabValue} index={0}>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Enter or paste text..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          disabled={isProcessing}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => processContent('text', textInput)}
          disabled={!textInput.trim() || isProcessing}
          sx={{ mt: 2 }}
        >
          {isProcessing ? <CircularProgress size={24} /> : 'Process Text'}
        </Button>
      </TabPanel>

      {/* URL Input Panel */}
      <TabPanel value={tabValue} index={1}>
        <TextField
          fullWidth
          placeholder="Enter URL..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          disabled={isProcessing}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => processContent('url', urlInput)}
          disabled={!urlInput.trim() || isProcessing}
          sx={{ mt: 2 }}
        >
          {isProcessing ? <CircularProgress size={24} /> : 'Fetch URL'}
        </Button>
      </TabPanel>

      {/* File Upload Panel */}
      <TabPanel value={tabValue} index={2}>
        <Button
          fullWidth
          variant="outlined"
          component="label"
          disabled={isProcessing}
        >
          Upload Document
          <input
            type="file"
            hidden
            accept=".txt,.pdf,.doc,.docx"
            onChange={handleFileUpload}
          />
        </Button>
      </TabPanel>

      {/* Content List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <List>
          {data.contents.map((content) => (
            <ListItem key={content.id}>
              <ListItemText
                primary={content.metadata.title || content.type}
                secondary={content.processed?.summary}
              />
              <ListItemSecondaryAction>
                <Tooltip title="Delete">
                  <IconButton 
                    edge="end" 
                    onClick={() => handleDeleteContent(content.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>

      {error && (
        <Typography color="error" sx={{ p: 2 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
} 