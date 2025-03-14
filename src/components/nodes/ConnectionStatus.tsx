import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import {
  Chat as ChatIcon,
  Note as NoteIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Link as UrlIcon,
  AutoAwesome as ImageGenIcon,
  MoreHoriz as MoreIcon
} from '@mui/icons-material';

interface ConnectionStatusProps {
  connectedNodes: Array<{
    type: string;
    count: number;
  }>;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connectedNodes }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'chatNode':
        return <ChatIcon fontSize="small" />;
      case 'notesNode':
        return <NoteIcon fontSize="small" />;
      case 'imageNode':
        return <ImageIcon fontSize="small" />;
      case 'documentNode':
        return <DocumentIcon fontSize="small" />;
      case 'urlNode':
        return <UrlIcon fontSize="small" />;
      case 'imageGenerationNode':
        return <ImageGenIcon fontSize="small" />;
      default:
        return <MoreIcon fontSize="small" />;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        alignItems: 'center',
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 1,
      }}
    >
      {connectedNodes.map((node, index) => (
        <Tooltip
          key={node.type}
          title={`${node.type.replace('Node', '')} (${node.count})`}
          arrow
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              color: 'primary.main',
            }}
          >
            {getIcon(node.type)}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}; 