import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent, IconButton, Menu, MenuItem, TextField, Typography, Box } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { NodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { ConnectionStatus } from './ConnectionStatus';
import { useReactFlow } from 'reactflow';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';

export const BaseNode: React.FC<NodeProps<NodeData>> = ({
  id,
  data,
  selected,
  children,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isEditingLabel, setIsEditingLabel] = React.useState(false);
  const [tempLabel, setTempLabel] = React.useState(data.label || '');
  const [dimensions, setDimensions] = React.useState({ width: 300, height: 400 });
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
    <div style={{ position: 'relative' }}>
      <Handle 
        type="target" 
        position={Position.Top}
        style={{ 
          background: '#555',
          width: 8,
          height: 8,
          zIndex: 1000,
          border: '2px solid #fff',
          top: -4,
          opacity: selected ? 1 : 0.5,
          transition: 'opacity 0.2s'
        }}
        isConnectable={true}
      />
      <ResizableBox
        width={dimensions.width}
        height={dimensions.height}
        onResize={(e, { size }) => {
          // Only stop propagation if the resize handle was clicked
          if ((e.target as HTMLElement).classList.contains('react-resizable-handle')) {
            e.stopPropagation();
          }
          // Snap to grid (15px)
          const snappedWidth = Math.round(size.width / 15) * 15;
          const snappedHeight = Math.round(size.height / 15) * 15;
          setDimensions({
            width: Math.max(200, Math.min(800, snappedWidth)),
            height: Math.max(200, Math.min(800, snappedHeight))
          });
        }}
        minConstraints={[200, 200]}
        maxConstraints={[800, 800]}
        resizeHandles={['se']}
        draggableOpts={{ grid: [15, 15] }}
        handle={
          <div
            className="react-resizable-handle react-resizable-handle-se nodrag"
            style={{
              width: 20,
              height: 20,
              bottom: -3,
              right: -3,
              cursor: 'se-resize',
              position: 'absolute',
              backgroundColor: selected ? 'rgba(144, 202, 249, 0.2)' : 'transparent',
              borderRadius: '0 0 4px 0',
              zIndex: 2,
              transition: 'background-color 0.2s'
            }}
          />
        }
      >
        <Card
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: selected ? 2 : 1,
            borderColor: selected ? 'primary.main' : 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            '& > *': { width: '100%', minHeight: 0 },
            position: 'relative',
          }}
        >
          <CardHeader
            sx={{
              p: 1,
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              flexShrink: 0,
            }}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ConnectionStatus connectedNodes={connectedNodes} />
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{ ml: 0.5 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            }
            title={
              isEditingLabel ? (
                <TextField
                  size="small"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  onBlur={handleLabelSubmit}
                  onKeyDown={handleLabelKeyPress}
                  autoFocus
                  fullWidth
                  onClick={(e) => e.stopPropagation()}
                  sx={{ mt: -0.5, mb: -0.5 }}
                />
              ) : (
                <Typography
                  variant="body1"
                  onClick={handleLabelClick}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    p: 0.5,
                    borderRadius: 0.5,
                  }}
                >
                  {data.label || `${data.type || 'Node'} ${id.slice(0, 4)}`}
                </Typography>
              )
            }
          />
          <CardContent
            sx={{
              p: 0,
              flex: 1,
              overflow: 'hidden',
              '& > *': {
                width: '100%',
                height: '100%',
                minHeight: 0,
              },
            }}
          >
            {children}
          </CardContent>
        </Card>
      </ResizableBox>
      <Handle 
        type="source" 
        position={Position.Bottom}
        style={{ 
          background: '#555',
          width: 8,
          height: 8,
          zIndex: 1000,
          border: '2px solid #fff',
          bottom: -4,
          opacity: selected ? 1 : 0.5,
          transition: 'opacity 0.2s'
        }}
        isConnectable={true}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </div>
  );
}; 