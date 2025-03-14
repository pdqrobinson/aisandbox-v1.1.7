import React, { useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  Paper,
  Typography,
} from '@mui/material';
import { BaseNode } from './BaseNode';
import { NotesNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';

export const NotesNode: React.FC<NodeProps<NotesNodeData>> = ({ id, data, selected }) => {
  const [content, setContent] = useState(data.content || '');
  const { updateNode } = useCanvasStore();

  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value;
    setContent(newContent);
    
    // Update node data
    updateNode(id, {
      ...data,
      content: newContent,
    });

    // Emit event for connected chat nodes
    const notesUpdateEvent = new CustomEvent('notesUpdate', {
      detail: { nodeId: id }
    });
    window.dispatchEvent(notesUpdateEvent);
  }, [id, data, updateNode]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '300px',
          width: '300px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Notes
          </Typography>
        </Box>

        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 0,
          }}
        >
          <TextField
            fullWidth
            multiline
            value={content}
            onChange={handleContentChange}
            placeholder="Enter your notes here..."
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                height: '100%',
              },
            }}
          />
        </Paper>
      </Box>
    </BaseNode>
  );
}; 