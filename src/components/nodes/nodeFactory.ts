import { ChatNode } from './ChatNode';
import { NotesNode } from './NotesNode';
import { ImageNode } from './ImageNode';
import { DocumentNode } from './DocumentNode';
import { UrlNode } from './UrlNode';
import { ImageGenerationNode } from './ImageGenerationNode';

export const nodeTypes = {
  chat: ChatNode,
  notes: NotesNode,
  image: ImageNode,
  document: DocumentNode,
  url: UrlNode,
  imageGeneration: ImageGenerationNode,
} as const;

export type NodeType = keyof typeof nodeTypes; 