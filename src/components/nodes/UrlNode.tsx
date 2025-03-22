import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Link,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Link as LinkIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { UrlNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { NodeCommunicationService } from '../../services/NodeCommunicationService';
import { urlFetchService, UrlMetadata } from '../../services/UrlFetchService';

export const UrlNode: React.FC<NodeProps<UrlNodeData>> = ({ id, data = {}, selected }) => {
  const { updateNode } = useCanvasStore();
  const [isEditingUrl, setIsEditingUrl] = useState(!data.url);
  const [urlInput, setUrlInput] = useState(data.url || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  
  const nodeCommunicationService = React.useMemo(() => NodeCommunicationService.getInstance(), []);
  
  // Handle URL submission
  const handleSubmitUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch URL metadata
      const metadata = await urlFetchService.fetchUrl(urlInput.trim());
      
      // Update node data
      updateNode(id, {
        ...data,
        url: metadata.url,
        title: metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        content: metadata.content,
        lastFetched: metadata.lastFetched,
      });
      
      // Exit edit mode
      setIsEditingUrl(false);
      
      // Notify connected nodes about the new content
      connectedNodes.forEach(nodeId => {
        nodeCommunicationService.sendMessage('update', {
          senderId: id,
          receiverId: nodeId,
          content: `${metadata.title}\n\n${metadata.description || ''}`,
          type: 'content',
          metadata: {
            type: 'url',
            url: metadata.url,
            title: metadata.title,
            description: metadata.description,
            source: id,
          }
        });
      });
    } catch (err) {
      console.error('Error fetching URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, id, data, updateNode, connectedNodes, nodeCommunicationService]);
  
  // Handle URL refresh
  const handleRefresh = useCallback(() => {
    if (!data.url) return;
    
    setIsLoading(true);
    setError(null);
    
    urlFetchService.fetchUrl(data.url, true)
      .then(metadata => {
        // Update node data
        updateNode(id, {
          ...data,
          title: metadata.title,
          description: metadata.description,
          thumbnail: metadata.thumbnail,
          content: metadata.content,
          lastFetched: metadata.lastFetched,
        });
        
        // Notify connected nodes about the updated content
        connectedNodes.forEach(nodeId => {
          nodeCommunicationService.sendMessage('update', {
            senderId: id,
            receiverId: nodeId,
            content: `${metadata.title}\n\n${metadata.description || ''}`,
            type: 'content',
            metadata: {
              type: 'url',
              url: metadata.url,
              title: metadata.title,
              description: metadata.description,
              source: id,
            }
          });
        });
      })
      .catch(err => {
        console.error('Error refreshing URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh URL');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [data, id, updateNode, connectedNodes, nodeCommunicationService]);
  
  // Handle key press in URL input
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmitUrl();
    }
  }, [handleSubmitUrl]);
  
  // Copy content to clipboard
  const handleCopyContent = useCallback(() => {
    if (!data.content) return;
    
    navigator.clipboard.writeText(data.content)
      .then(() => {
        console.log('Content copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy content:', err);
      });
  }, [data.content]);
  
  // Set up event listeners for node connections
  useEffect(() => {
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'update'],
      (message) => {
        console.log('UrlNode: Received message:', message);
        
        if (message.eventType === 'connect' && message.senderId !== id) {
          // Add to connected nodes
          setConnectedNodes(prev => {
            const updated = new Set(prev);
            updated.add(message.senderId);
            return updated;
          });
          
          // Send current content to the newly connected node
          if (data.url && data.title) {
            nodeCommunicationService.sendMessage('update', {
              senderId: id,
              receiverId: message.senderId,
              content: `${data.title}\n\n${data.description || ''}`,
              type: 'content',
              metadata: {
                type: 'url',
                url: data.url,
                title: data.title,
                description: data.description,
                source: id,
              }
            });
          }
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
  }, [id, data, nodeCommunicationService, isLoading]);
  
  return (
    <BaseNode selected={selected} nodeId={id}>
      <Box
        sx={{
          width: 320,
          bgcolor: 'background.paper',
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: 1,
        }}
      >
        <Box
          sx={{
            p: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle2">URL Node</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {data.content && (
              <Tooltip title="Copy Content">
                <IconButton size="small" onClick={handleCopyContent}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Paper sx={{ p: 1.5 }} elevation={0}>
          <Box sx={{ mb: 1.5 }}>
            {isEditingUrl ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  error={!!error}
                  helperText={error}
                  InputProps={{
                    startAdornment: (
                      <LinkIcon sx={{ mr: 1, color: 'action.active' }} />
                    ),
                  }}
                />
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleSubmitUrl}
                  title="Fetch content"
                >
                  <CheckIcon />
                </IconButton>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <LinkIcon sx={{ mr: 1, color: 'primary.main', fontSize: '1.2rem' }} />
                  <Link
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'primary.main',
                    }}
                  >
                    {data.url || 'No external URL provided'}
                  </Link>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={handleRefresh}
                    disabled={isLoading || !data.url}
                    title="Refresh external content"
                  >
                    {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setIsEditingUrl(true)}
                    title="Edit URL"
                  >
                    <EditIcon />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Fetching external content...
              </Typography>
            </Box>
          )}
          {data.url && !isLoading && (
            <Box sx={{ 
              borderLeft: '2px solid',
              borderColor: 'primary.main',
              pl: 1,
              ml: 1
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                External Content Preview
              </Typography>
              {data.thumbnail && (
                <Box
                  sx={{
                    width: '100%',
                    height: '150px',
                    overflow: 'hidden',
                    borderRadius: 1,
                    position: 'relative',
                    mb: 1,
                  }}
                >
                  <img
                    src={data.thumbnail}
                    alt={data.title || 'Website preview'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Box>
              )}
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 'medium',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {data.title || 'Untitled webpage'}
              </Typography>
              {data.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {data.description}
                </Typography>
              )}
              {data.lastFetched && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Last fetched: {new Date(data.lastFetched).toLocaleString()}
                </Typography>
              )}
              
              {connectedNodes.size > 0 && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    Connected to {connectedNodes.size} node{connectedNodes.size !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          {error && (
            <Typography color="error" variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Error fetching external content: {error}
            </Typography>
          )}
        </Paper>
      </Box>
    </BaseNode>
  );
};
