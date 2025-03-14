# AI Sandbox

An interactive sandbox environment for AI agents using the Cohere API. This project allows you to create, connect, and interact with multiple AI agents in a visual interface.

## Features

- Create and manage multiple AI agents
- Visual node-based interface using React Flow
- Real-time agent interactions
- Connection status monitoring
- Support for different AI roles and behaviors
- Integration with Cohere's API

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A Cohere API key

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd ai-sandbox
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Cohere API key:
```env
COHERE_API_KEY=your-api-key-here
```

4. Start the development server:
```bash
npm run dev:all
```

This will start both the client (port 3000) and server (port 3002).

## Usage

1. Open http://localhost:3000 in your browser
2. Click "Add Agent" to create a new AI agent
3. Configure the agent with your Cohere API key and desired settings
4. Use the chat interface to interact with the agent
5. Connect multiple agents to create an interactive network

## Development

- Client: React + Vite + TypeScript
- Server: Express.js
- UI Components: Material-UI
- Graph Visualization: React Flow
- API Integration: Cohere

## Scripts

- `npm run dev:all` - Start both client and server in development mode
- `npm run dev:client` - Start only the client
- `npm run dev:server` - Start only the server
- `npm run build` - Build the client for production

## License

MIT 