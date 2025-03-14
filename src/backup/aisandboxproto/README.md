# AI Sandbox Prototype Restore Point

This directory contains a restore point of the AI Sandbox prototype implementation.

## Files Included

1. `AgentBehavior.ts` - Contains the agent behavior management system:
   - Action and state interfaces
   - Agent behavior manager class
   - Role-based permission validation
   - Performance tracking

2. `AINode.tsx` - Contains the main node component:
   - Chat interface with shared conversations
   - Settings panel with model and role selection
   - Agent panel with state and action history
   - Role-based interaction rules
   - Message sharing between connected nodes

## Key Features

- Role-based interactions between AI agents
- Shared conversations between connected nodes
- Agent behavior tracking and performance metrics
- Support for multiple AI models (OpenAI and Cohere)
- Role-based permission system
- Real-time message sharing and interaction recording

## Dependencies

- React
- Material-UI
- ReactFlow
- Cohere AI SDK
- TypeScript

## Usage

To restore this version:

1. Copy the files from this directory to their respective locations in the project
2. Ensure all dependencies are installed
3. The system should maintain all functionality including:
   - Agent interactions
   - Role management
   - Message sharing
   - Performance tracking

## Notes

- This is a prototype version focusing on core functionality
- Some features may require additional configuration (API keys, etc.)
- The system is designed to be extensible for future enhancements 