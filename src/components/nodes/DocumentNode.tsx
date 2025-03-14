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
  Description as DocumentIcon,
} from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { DocumentNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';

export const DocumentNode: React.FC<NodeProps<DocumentNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempUrl, setTempUrl] = useState(data.documentUrl || '');
  const [tempTitle, setTempTitle] = useState(data.title || '');
  const { updateNode } = useCanvasStore();

  const handleUrlSubmit = useCallback(() => {
    if (tempUrl.trim()) {
      updateNode(id, {
        ...data,
        documentUrl: tempUrl.trim(),
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <DocumentIcon color="primary" />
            {isEditingTitle ? (
              <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleTitleSubmit)}
                  placeholder="Enter document title..."
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
                  {data.title || 'Untitled Document'}
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
                placeholder="Enter document URL..."
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
              {data.documentUrl ? (
                <Link
                  href={data.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.documentUrl}
                </Link>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ flex: 1 }}
                >
                  No document URL provided
                </Typography>
              )}
              <IconButton
                size="small"
                onClick={() => setIsEditingUrl(true)}
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