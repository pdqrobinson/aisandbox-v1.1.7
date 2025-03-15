import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent, IconButton, Menu, MenuItem, TextField, Typography, Box } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { NodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { ConnectionStatus } from './ConnectionStatus';
import { useReactFlow } from 'reactflow';

export const BaseNode: React.FC<NodeProps<NodeData>> = ({
  id,
  data,
  selected,
  children,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isEditingLabel, setIsEditingLabel] = React.useState(false);
  const [tempLabel, setTempLabel] = React.useState(data.label || '');
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const { getEdges } = useReactFlow();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = () => {
    handleMenuClose();
    removeNode(id);
  };

  const handleLabelClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setIsEditingLabel(true);
  };

  const handleLabelSubmit = () => {
    if (tempLabel.trim() !== data.label) {
      updateNode(id, {
        ...data,
        label: tempLabel.trim() || `${data.type || 'Node'} ${id.slice(0, 4)}`
      });
    }
    setIsEditingLabel(false);
  };

  const handleLabelKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleLabelSubmit();
    } else if (event.key === 'Escape') {
      setIsEditingLabel(false);
      setTempLabel(data.label || '');
    }
  };

  // Get connected nodes information
  const connectedNodes = React.useMemo(() => {
    const edges = getEdges();
    const connectedTypes = edges
      .filter(edge => edge.source === id || edge.target === id)
      .map(edge => {
        const connectedId = edge.source === id ? edge.target : edge.source;
        const node = getEdges().find(e => e.source === connectedId || e.target === connectedId);
        return node?.type || 'unknown';
      });

    // Count occurrences of each type
    const typeCounts = connectedTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array format
    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count
    }));
  }, [id, getEdges]);

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card
        sx={{
          minWidth: 250,
          maxWidth: 350,
          border: selected ? '2px solid #90caf9' : 'none',
        }}
      >
        <CardHeader
          action={
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              sx={{ marginRight: -1 }}
            >
              <MoreVertIcon />
            </IconButton>
          }
          title={
            isEditingLabel ? (
              <TextField
                fullWidth
                size="small"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onBlur={handleLabelSubmit}
                onKeyDown={handleLabelKeyPress}
                placeholder={`${data.type || 'Node'} ${id.slice(0, 4)}`}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '1rem',
                    padding: '2px 4px',
                  }
                }}
              />
            ) : (
              <Box>
                <Typography
                  variant="h6"
                  component="div"
                  onClick={handleLabelClick}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      borderRadius: 0.5,
                    },
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '2px 4px',
                  }}
                >
                  {data.label || `${data.type || 'Node'} ${id.slice(0, 4)}`}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    pl: '4px',
                    fontSize: '0.7rem',
                  }}
                >
                  ID: {id}
                </Typography>
              </Box>
            )
          }
          sx={{
            '& .MuiCardHeader-content': { overflow: 'hidden' },
            pb: 0, // Reduce padding at bottom of header
          }}
        />
        <CardContent>{children}</CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} />

      <ConnectionStatus connectedNodes={connectedNodes} />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          setIsEditingLabel(true);
        }}>
          Rename
        </MenuItem>
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </>
  );
}; 