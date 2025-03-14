import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent, IconButton, Menu, MenuItem } from '@mui/material';
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
  const removeNode = useCanvasStore((state) => state.removeNode);
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
          title={data.label}
          sx={{
            '& .MuiCardHeader-content': { overflow: 'hidden' },
            '& .MuiCardHeader-title': {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
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
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </>
  );
}; 