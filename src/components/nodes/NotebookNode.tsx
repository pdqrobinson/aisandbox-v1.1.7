import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Code as CodeIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { NotebookNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { NodeCommunicationService } from '../../services/NodeCommunicationService';
import { ollamaService, OllamaMessage } from '../../services/OllamaService';
import { notePersistenceService } from '../../services/NotePersistenceService';

// Define cell types
type CellType = 'markdown' | 'code';
type CellState = 'idle' | 'running' | 'error' | 'success';

// Define cell interface
interface Cell {
  id: string;
  type: CellType;
  content: string;
  output?: string;
  state: CellState;
  isCollapsed?: boolean;
  error?: string;
}

export const NotebookNode: React.FC<NodeProps<NotebookNodeData>> = ({ id, data = {}, selected }) => {
  const { updateNode } = useCanvasStore();
  const [cells, setCells] = useState<Cell[]>(data.cells || []);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ollamaModel, setOllamaModel] = useState<string>(data.ollamaModel || 'llama3');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(data.ollamaBaseUrl || 'http://localhost:11434');
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  
  const nodeCommunicationService = React.useMemo(() => NodeCommunicationService.getInstance(), []);
  
  // Load cells from persistence on mount
  useEffect(() => {
    const savedCells = notePersistenceService.loadNotes(id);
    if (savedCells) {
      setCells(savedCells);
      updateNode(id, {
        ...data,
        cells: savedCells,
      });
    } else if (cells.length === 0) {
      // Add a default markdown cell if no cells exist
      const defaultCell: Cell = {
        id: `cell-${Date.now()}`,
        type: 'markdown',
        content: '# Notebook\n\nWelcome to the notebook! You can write markdown here or create code cells.',
        state: 'idle',
      };
      setCells([defaultCell]);
      updateNode(id, {
        ...data,
        cells: [defaultCell],
      });
    }
  }, [id]);
  
  // Save cells to persistence when they change
  useEffect(() => {
    if (cells.length > 0) {
      notePersistenceService.saveNotes(id, cells);
      updateNode(id, {
        ...data,
        cells,
        ollamaModel,
        ollamaBaseUrl,
      });
    }
  }, [cells, id, ollamaModel, ollamaBaseUrl, updateNode, data]);
  
  // Load available Ollama models
  const loadOllamaModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      ollamaService.setBaseUrl(ollamaBaseUrl);
      const models = await ollamaService.listModels();
      setAvailableModels(models.map(model => model.name));
    } catch (error) {
      console.error('Error loading Ollama models:', error);
      setAvailableModels(['llama3', 'codellama', 'mistral']);
    } finally {
      setIsLoadingModels(false);
    }
  }, [ollamaBaseUrl]);
  
  // Load models when settings are opened
  useEffect(() => {
    if (isSettingsOpen) {
      loadOllamaModels();
    }
  }, [isSettingsOpen, loadOllamaModels]);
  
  // Add a new cell
  const addCell = useCallback((type: CellType, afterCellId?: string) => {
    const newCell: Cell = {
      id: `cell-${Date.now()}`,
      type,
      content: '',
      state: 'idle',
    };
    
    setCells(prevCells => {
      if (!afterCellId) {
        return [...prevCells, newCell];
      }
      
      const index = prevCells.findIndex(cell => cell.id === afterCellId);
      if (index === -1) {
        return [...prevCells, newCell];
      }
      
      const newCells = [...prevCells];
      newCells.splice(index + 1, 0, newCell);
      return newCells;
    });
    
    setActiveCell(newCell.id);
  }, []);
  
  // Delete a cell
  const deleteCell = useCallback((cellId: string) => {
    setCells(prevCells => prevCells.filter(cell => cell.id !== cellId));
    
    if (activeCell === cellId) {
      setActiveCell(null);
    }
  }, [activeCell]);
  
  // Update cell content
  const updateCellContent = useCallback((cellId: string, content: string) => {
    setCells(prevCells => 
      prevCells.map(cell => 
        cell.id === cellId ? { ...cell, content } : cell
      )
    );
  }, []);
  
  // Toggle cell collapse
  const toggleCellCollapse = useCallback((cellId: string) => {
    setCells(prevCells => 
      prevCells.map(cell => 
        cell.id === cellId ? { ...cell, isCollapsed: !cell.isCollapsed } : cell
      )
    );
  }, []);
  
  // Run a code cell
  const runCodeCell = useCallback(async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code') return;
    
    // Update cell state to running
    setCells(prevCells => 
      prevCells.map(c => 
        c.id === cellId ? { ...c, state: 'running', output: '', error: undefined } : c
      )
    );
    
    try {
      // Set up Ollama service
      ollamaService.setBaseUrl(ollamaBaseUrl);
      
      // Prepare context from previous cells
      const cellIndex = cells.findIndex(c => c.id === cellId);
      const previousCells = cells.slice(0, cellIndex);
      
      const context = previousCells
        .map(c => `${c.type === 'code' ? '```python\n' + c.content + '\n```' : c.content}${c.output ? '\nOutput: ' + c.output : ''}`)
        .join('\n\n');
      
      // Prepare messages for Ollama
      const messages: OllamaMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful coding assistant that executes Python code and returns the results. Only return the output of the code execution, nothing else. If there is an error, explain it briefly.'
        },
        {
          role: 'user',
          content: `Given the following context from previous cells:\n\n${context}\n\nExecute the following Python code and return only the output:\n\n\`\`\`python\n${cell.content}\n\`\`\``
        }
      ];
      
      // Call Ollama
      const response = await ollamaService.chat(ollamaModel, messages);
      
      // Update cell with output
      setCells(prevCells => 
        prevCells.map(c => 
          c.id === cellId ? { ...c, state: 'success', output: response.message.content } : c
        )
      );
      
      // Share result with connected nodes
      connectedNodes.forEach(nodeId => {
        nodeCommunicationService.sendMessage('update', {
          senderId: id,
          receiverId: nodeId,
          content: `Code cell execution result:\n\n${response.message.content}`,
          type: 'content',
          metadata: {
            type: 'notebook',
            cellId,
            cellContent: cell.content,
            cellOutput: response.message.content,
            source: id,
          }
        });
      });
    } catch (error) {
      console.error('Error running code cell:', error);
      
      // Update cell with error
      setCells(prevCells => 
        prevCells.map(c => 
          c.id === cellId ? { 
            ...c, 
            state: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error',
            output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          } : c
        )
      );
    }
  }, [cells, ollamaBaseUrl, ollamaModel, id, connectedNodes, nodeCommunicationService]);
  
  // Set up event listeners for node connections
  useEffect(() => {
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'update'],
      (message) => {
        console.log('NotebookNode: Received message:', message);
        
        if (message.eventType === 'connect' && message.senderId !== id) {
          // Add to connected nodes
          setConnectedNodes(prev => {
            const updated = new Set(prev);
            updated.add(message.senderId);
            return updated;
          });
          
          // Send current notebook state to the newly connected node
          nodeCommunicationService.sendMessage('update', {
            senderId: id,
            receiverId: message.senderId,
            content: `Notebook with ${cells.length} cells`,
            type: 'content',
            metadata: {
              type: 'notebook',
              cellCount: cells.length,
              source: id,
            }
          });
        } else if (message.eventType === 'disconnect') {
          // Remove from connected nodes
          setConnectedNodes(prev => {
            const updated = new Set(prev);
            updated.delete(message.senderId);
            return updated;
          });
        }
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, [id, cells, nodeCommunicationService]);
  
  // Render a markdown cell
  const renderMarkdownCell = (cell: Cell) => {
    const isActive = activeCell === cell.id;
    
    return (
      <Paper
        elevation={isActive ? 2 : 0}
        sx={{
          p: 1,
          mb: 1,
          border: '1px solid',
          borderColor: isActive ? 'primary.main' : 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Markdown
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => toggleCellCollapse(cell.id)}
              title={cell.isCollapsed ? "Expand" : "Collapse"}
            >
              {cell.isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => deleteCell(cell.id)}
              title="Delete cell"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {!cell.isCollapsed && (
          <>
            {isActive ? (
              <TextField
                fullWidth
                multiline
                variant="outlined"
                value={cell.content}
                onChange={(e) => updateCellContent(cell.id, e.target.value)}
                onBlur={() => setActiveCell(null)}
                autoFocus
                sx={{ mb: 1 }}
              />
            ) : (
              <Box
                onClick={() => setActiveCell(cell.id)}
                sx={{
                  p: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  minHeight: '2rem',
                }}
              >
                {/* In a real implementation, render markdown here */}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {cell.content}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addCell('code', cell.id)}
            sx={{ mr: 1 }}
          >
            Code
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addCell('markdown', cell.id)}
          >
            Markdown
          </Button>
        </Box>
      </Paper>
    );
  };
  
  // Render a code cell
  const renderCodeCell = (cell: Cell) => {
    const isActive = activeCell === cell.id;
    
    return (
      <Paper
        elevation={isActive ? 2 : 0}
        sx={{
          p: 1,
          mb: 1,
          border: '1px solid',
          borderColor: isActive ? 'primary.main' : 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Code
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => runCodeCell(cell.id)}
              title="Run cell"
              disabled={cell.state === 'running'}
              color={cell.state === 'success' ? 'success' : cell.state === 'error' ? 'error' : 'default'}
            >
              {cell.state === 'running' ? <CircularProgress size={16} /> : <RunIcon fontSize="small" />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => toggleCellCollapse(cell.id)}
              title={cell.isCollapsed ? "Expand" : "Collapse"}
            >
              {cell.isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => deleteCell(cell.id)}
              title="Delete cell"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {!cell.isCollapsed && (
          <>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                variant="outlined"
                value={cell.content}
                onChange={(e) => updateCellContent(cell.id, e.target.value)}
                onFocus={() => setActiveCell(cell.id)}
                sx={{
                  mb: 1,
                  fontFamily: 'monospace',
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 0.5,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => runCodeCell(cell.id)}
                  title="Run cell"
                  disabled={cell.state === 'running'}
                  sx={{
                    bgcolor: 'background.paper',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {cell.state === 'running' ? <CircularProgress size={16} /> : <RunIcon fontSize="small" />}
                </IconButton>
              </Box>
            </Box>
            
            {cell.output && (
              <Paper
                sx={{
                  p: 1,
                  mb: 1,
                  bgcolor: cell.state === 'error' ? 'error.light' : 'action.hover',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                }}
              >
                {cell.output}
              </Paper>
            )}
          </>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addCell('code', cell.id)}
            sx={{ mr: 1 }}
          >
            Code
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addCell('markdown', cell.id)}
          >
            Markdown
          </Button>
        </Box>
      </Paper>
    );
  };
  
  return (
    <BaseNode selected={selected} nodeId={id}>
      <Box
        sx={{
          width: 400,
          height: 500,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="subtitle2" fontWeight="medium">
            Notebook
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Settings">
              <IconButton
                size="small"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 1,
          }}
        >
          {cells.map(cell => (
            <React.Fragment key={cell.id}>
              {cell.type === 'markdown' ? renderMarkdownCell(cell) : renderCodeCell(cell)}
            </React.Fragment>
          ))}
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => addCell('code')}
              sx={{ mr: 1 }}
            >
              Code
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => addCell('markdown')}
            >
              Markdown
            </Button>
          </Box>
        </Box>
        
        {/* Settings Dialog */}
        <Dialog
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Notebook Settings</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                fullWidth
                label="Ollama Base URL"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                helperText="The base URL for the Ollama API (e.g., http://localhost:11434)"
              />
              
              <FormControl fullWidth>
                <InputLabel>Ollama Model</InputLabel>
                <Select
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  label="Ollama Model"
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? (
                    <MenuItem value="">
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Loading models...
                    </MenuItem>
                  ) : (
                    availableModels.map(model => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              <Button
                variant="outlined"
                onClick={loadOllamaModels}
                disabled={isLoadingModels}
                startIcon={isLoadingModels ? <CircularProgress size={20} /> : <RefreshIcon />}
              >
                Refresh Models
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsSettingsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </BaseNode>
  );
};
