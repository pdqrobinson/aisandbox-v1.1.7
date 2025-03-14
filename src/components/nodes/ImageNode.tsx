import React, { useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
} from '@mui/material';
import { Edit as EditIcon, Check as CheckIcon } from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { ImageNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';

export const ImageNode: React.FC<NodeProps<ImageNodeData>> = ({ id, data, selected }) => {
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [tempUrl, setTempUrl] = useState(data.imageUrl || '');
  const [tempCaption, setTempCaption] = useState(data.caption || '');
  const { updateNode } = useCanvasStore();

  const handleUrlSubmit = useCallback(() => {
    if (tempUrl.trim()) {
      updateNode(id, {
        ...data,
        imageUrl: tempUrl.trim(),
      });
    }
    setIsEditingUrl(false);
  }, [id, data, tempUrl, updateNode]);

  const handleCaptionSubmit = useCallback(() => {
    updateNode(id, {
      ...data,
      caption: tempCaption.trim(),
    });
    setIsEditingCaption(false);
  }, [id, data, tempCaption, updateNode]);

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
        {data.imageUrl ? (
          <Paper
            sx={{
              position: 'relative',
              width: '100%',
              paddingTop: '75%', // 4:3 aspect ratio
              overflow: 'hidden',
            }}
          >
            <img
              src={data.imageUrl}
              alt={data.caption || 'Image'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Paper>
        ) : (
          <Paper
            sx={{
              p: 2,
              textAlign: 'center',
              bgcolor: 'background.default',
            }}
          >
            <Typography color="text.secondary">No image URL provided</Typography>
          </Paper>
        )}

        <Box sx={{ p: 1 }}>
          {isEditingUrl ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleUrlSubmit)}
                placeholder="Enter image URL..."
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
                justifyContent: 'flex-end',
                mb: 1,
              }}
            >
              <IconButton
                size="small"
                onClick={() => setIsEditingUrl(true)}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}

          {isEditingCaption ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={tempCaption}
                onChange={(e) => setTempCaption(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleCaptionSubmit)}
                placeholder="Enter caption..."
                autoFocus
              />
              <IconButton
                size="small"
                color="primary"
                onClick={handleCaptionSubmit}
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
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1 }}
              >
                {data.caption || 'Add a caption...'}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setIsEditingCaption(true)}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    </BaseNode>
  );
}; 