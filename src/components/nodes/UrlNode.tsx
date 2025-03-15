import React, { useState, useCallback, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { UrlNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { messageBus } from '../../services/MessageBus';
import { NodeCommunicationService } from '../../services/NodeCommunicationService';
import { nodeCapabilityService } from '../../services/NodeCapabilityService';
import { UrlFetchService } from '../../services/UrlFetchService';

export const UrlNode: React.FC<NodeProps<UrlNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempUrl, setTempUrl] = useState(data.url || '');
  const [tempTitle, setTempTitle] = useState(data.title || '');
  const [tempDescription, setTempDescription] = useState(data.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const { updateNode } = useCanvasStore();
  const nodeCommunicationService = React.useMemo(() => NodeCommunicationService.getInstance(), []);

  // Initialize node capabilities and communication
  useEffect(() => {
    // Register node capabilities
    nodeCapabilityService.registerCapabilities(id, [{
      type: 'urlNode',
      metadata: {
        canFetch: true,
        hasContent: true,
        isEditable: true
      }
    }]);

    // Subscribe to events
    const unsubscribe = nodeCommunicationService.subscribeToEvents(
      id,
      ['connect', 'disconnect', 'request'],
      (message) => {
        console.log('UrlNode received message:', message);
        
        switch (message.eventType) {
          case 'connect':
            if (message.metadata?.target === id) {
              console.log('UrlNode: Handling connection from:', message.senderId);
              setConnectedNodes(prev => {
                const updated = new Set(prev);
                updated.add(message.senderId);
                return updated;
              });
              
              // Send capabilities back to the connecting node
              messageBus.emit('connect', {
                senderId: id,
                receiverId: message.senderId,
                content: 'Connection accepted',
                type: 'connection',
                metadata: {
                  type: 'urlNode',
                  capabilities: nodeCapabilityService.getCapabilities(id),
                  source: id,
                  target: message.senderId,
                  contentStatus: data.url ? 'has_content' : 'empty'
                }
              });

              // Send current content to the connecting node
              if (data.url) {
                console.log('UrlNode: Sending content update to:', message.senderId, data);
                messageBus.emit('update', {
                  senderId: id,
                  receiverId: message.senderId,
                  type: 'content',
                  content: {
                    url: data.url || null,
                    title: data.title || null,
                    description: data.description || null,
                    content: data.content || null,
                    thumbnail: data.thumbnail || null,
                    lastFetched: data.lastFetched || null,
                    hasContent: Boolean(data.url && (data.title || data.content)),
                    isLoading: isLoading
                  },
                  metadata: {
                    type: 'urlNode',
                    timestamp: Date.now(),
                    contentStatus: data.url ? (isLoading ? 'loading' : 'has_content') : 'empty'
                  }
                });
              }
            }
            break;
          case 'disconnect':
            if (message.metadata?.target === id) {
              setConnectedNodes(prev => {
                const updated = new Set(prev);
                updated.delete(message.senderId);
                return updated;
              });
            }
            break;
          case 'request':
            if (message.metadata?.type === 'content' && data.url) {
              console.log('UrlNode: Sending content update on request to:', message.senderId, data);
              messageBus.emit('update', {
                senderId: id,
                receiverId: message.senderId,
                type: 'content',
                content: {
                  url: data.url || null,
                  title: data.title || null,
                  description: data.description || null,
                  content: data.content || null,
                  thumbnail: data.thumbnail || null,
                  lastFetched: data.lastFetched || null,
                  hasContent: Boolean(data.url && (data.title || data.content)),
                  isLoading: isLoading
                },
                metadata: {
                  type: 'urlNode',
                  timestamp: Date.now(),
                  contentStatus: data.url ? (isLoading ? 'loading' : 'has_content') : 'empty'
                }
              });
            }
            break;
        }
      }
    );

    return () => {
      unsubscribe();
      nodeCapabilityService.unregisterNode(id);
    };
  }, [id, data, nodeCommunicationService, isLoading]);

  // Add handleDisconnectAll function
  const handleDisconnectAll = useCallback(() => {
    Array.from(connectedNodes).forEach(nodeId => {
      messageBus.emit('disconnect', {
        senderId: id,
        receiverId: nodeId,
        type: 'disconnect',
        metadata: {
          type: 'urlNode',
          source: id,
          target: nodeId
        }
      });
    });

    setConnectedNodes(new Set());
  }, [id, connectedNodes]);

  // Function to fetch and process URL content
  const fetchUrlContent = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);

    // Validate URL format
    try {
      new URL(url); // This will throw if URL is invalid
    } catch (error) {
      setError('Invalid URL format. Please enter a valid URL starting with http:// or https://');
      setIsLoading(false);
      return;
    }

    // Emit loading state
    messageBus.emit('update', {
      senderId: id,
      type: 'content',
      content: {
        url: url,
        title: data.title || null,
        description: data.description || null,
        content: data.content || null,
        thumbnail: data.thumbnail || null,
        lastFetched: data.lastFetched || null,
        hasContent: false,
        isLoading: true
      },
      metadata: {
        type: 'urlNode',
        timestamp: Date.now(),
        contentStatus: 'loading'
      }
    });

    try {
      console.log('Fetching URL content for:', url);
      const content = await UrlFetchService.fetchUrlContent(url);
      console.log('Received content:', content);
      
      // Update node data
      const updatedData = {
        ...data,
        url,
        title: content.title || null,
        description: content.description || null,
        thumbnail: content.thumbnail || null,
        content: content.content || null,
        lastFetched: new Date().toISOString()
      };
      
      updateNode(id, updatedData);

      // Emit content update event with complete state
      messageBus.emit('update', {
        senderId: id,
        type: 'content',
        content: {
          url: updatedData.url,
          title: updatedData.title,
          description: updatedData.description,
          content: updatedData.content,
          thumbnail: updatedData.thumbnail,
          lastFetched: updatedData.lastFetched,
          hasContent: Boolean(updatedData.url && updatedData.title),
          isLoading: false
        },
        metadata: {
          type: 'urlNode',
          timestamp: Date.now(),
          contentStatus: 'has_content'
        }
      });

    } catch (error) {
      console.error('Error fetching URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch URL content';
      setError(errorMessage);
      
      // Emit error state
      messageBus.emit('update', {
        senderId: id,
        type: 'content',
        content: {
          url: url,
          title: null,
          description: null,
          content: null,
          thumbnail: null,
          lastFetched: null,
          hasContent: false,
          isLoading: false,
          error: errorMessage
        },
        metadata: {
          type: 'urlNode',
          timestamp: Date.now(),
          contentStatus: 'error'
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, data, updateNode]);

  // Fetch content when URL is submitted
  const handleSubmitUrl = useCallback(async () => {
    if (!tempUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Normalize URL
    let normalizedUrl = tempUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    setIsEditingUrl(false);
    await fetchUrlContent(normalizedUrl);
  }, [tempUrl, fetchUrlContent]);

  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    if (data.url) {
      fetchUrlContent(data.url);
    }
  }, [data.url, fetchUrlContent]);

  const handleTitleSubmit = useCallback(() => {
    if (tempTitle.trim()) {
      updateNode(id, {
        ...data,
        title: tempTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  }, [id, data, tempTitle, updateNode]);

  const handleDescriptionSubmit = useCallback(() => {
    updateNode(id, {
      ...data,
      description: tempDescription.trim(),
    });
    setIsEditingDescription(false);
  }, [id, data, tempDescription, updateNode]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent, submitFn: () => void) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitFn();
      }
    },
    []
  );

  // Initial fetch if URL exists
  useEffect(() => {
    if (data.url && !data.content && !isLoading) {
      fetchUrlContent(data.url);
    }
  }, [data.url, data.content, fetchUrlContent, isLoading]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '300px',
          overflow: 'hidden',
        }}
      >
        <Paper
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.default',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                External Web Content {connectedNodes.size > 0 ? `(${connectedNodes.size} connected)` : ''}
              </Typography>
            </Box>
            {connectedNodes.size > 0 && (
              <IconButton
                size="small"
                onClick={handleDisconnectAll}
                title="Disconnect All Nodes"
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.main',
                    color: 'error.contrastText',
                  },
                }}
              >
                <LinkOffIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
              Enter website URL to fetch external content
            </Typography>
            {isEditingUrl ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleSubmitUrl)}
                  placeholder="Enter any website URL..."
                  autoFocus
                  InputProps={{
                    startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />,
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