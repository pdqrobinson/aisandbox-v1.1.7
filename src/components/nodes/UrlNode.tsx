import React, { useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Link,
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { UrlNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';

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
  const { updateNode } = useCanvasStore();

  const handleUrlSubmit = useCallback(() => {
    if (tempUrl.trim()) {
      updateNode(id, {
        ...data,
        url: tempUrl.trim(),
      });
    }
    setIsEditingUrl(false);
  }, [id, data, tempUrl, updateNode]);

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
          {data.thumbnail && (
            <Box
              sx={{
                width: '100%',
                height: '150px',
                overflow: 'hidden',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <img
                src={data.thumbnail}
                alt={data.title || 'URL preview'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Box>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <LinkIcon color="primary" />
            {isEditingTitle ? (
              <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleTitleSubmit)}
                  placeholder="Enter title..."
                  autoFocus
                />
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleTitleSubmit}
                >
                  <CheckIcon />
                </IconButton>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="subtitle1">
                  {data.title || 'Untitled Link'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <EditIcon />
                </IconButton>
              </Box>
            )}
          </Box>

          {isEditingUrl ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleUrlSubmit)}
                placeholder="Enter URL..."
                autoFocus
              />
              <IconButton
                size="small"
                color="primary"
                onClick={handleUrlSubmit}
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
              }}
            >
              <Link
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {data.url}
              </Link>
              <IconButton
                size="small"
                onClick={() => setIsEditingUrl(true)}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}

          {isEditingDescription ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleDescriptionSubmit)}
                placeholder="Enter description..."
                autoFocus
              />
              <IconButton
                size="small"
                color="primary"
                onClick={handleDescriptionSubmit}
              >
                <CheckIcon />
              </IconButton>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  flex: 1,
                  mr: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {data.description || 'Add a description...'}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setIsEditingDescription(true)}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}
        </Paper>
      </Box>
    </BaseNode>
  );
}; 