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
      <Handle type="target" position={Position.Top} />
      <ResizableBox
        width={dimensions.width}
        height={dimensions.height}
        onResize={(e, { size }) => {
          e.stopPropagation();
          setDimensions({
            width: Math.max(200, Math.min(800, size.width)),
            height: Math.max(200, Math.min(800, size.height))
          });
        }}
        minConstraints={[200, 200]}
        maxConstraints={[800, 800]}
        resizeHandles={['se']}
        draggableOpts={{ grid: [1, 1] }}
        handle={
          <div
            className="nodrag react-resizable-handle react-resizable-handle-se"
            style={{
              width: 20,
              height: 20,
              bottom: 0,
              right: 0,
              cursor: 'se-resize',
              position: 'absolute',
              backgroundColor: selected ? 'rgba(144, 202, 249, 0.2)' : 'transparent',
              borderRadius: '0 0 4px 0',
              zIndex: 2
            }}
          />
        }
      >
        <Card
          sx={{
            width: '100%',
            height: '100%',
            border: selected ? '2px solid #90caf9' : 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            pr: 2,
            pl: 2,
            pb: 2,
            '& > *': {
              width: '100%',
              minHeight: 0
            }
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
              ) :
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
            }
            sx={{
              '& .MuiCardHeader-content': { overflow: 'hidden' },
              pb: 0,
              flexShrink: 0
            }}
          />
          <CardContent sx={{ 
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: 0,
            '&:last-child': {
              pb: 0
            },
            minHeight: 0,
            '& > *': {
              width: '100%',
              height: '100%',
              minHeight: 0
            }
          }}>
            {children}
          </CardContent>
        </Card>
      </ResizableBox>
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
    </div>
  );
}; 