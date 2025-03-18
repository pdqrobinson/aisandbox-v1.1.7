# AI Sandbox

A visual programming environment for AI-powered nodes that can be connected together to create complex workflows.

## Features

- Visual node-based programming interface
- Resizable nodes with drag-and-drop functionality
- Multiple node types (Chat, Notes, URL, etc.)
- Real-time node communication
- Dark theme UI
- Responsive layout with collapsible sidebar

## Tech Stack

- React
- TypeScript
- Material-UI
- React Flow
- Express.js
- Node.js

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd ai-sandbox
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev:all
```

This will start both the frontend (Vite) and backend (Express) servers:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

### Production Build

To create a production build:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

## Project Structure

```
ai-sandbox/
├── server/           # Backend Express server
├── src/
│   ├── components/   # React components
│   ├── contexts/     # React contexts
│   ├── services/     # API services
│   ├── store/        # State management
│   ├── styles/       # Global styles
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
├── public/           # Static assets
└── package.json      # Project configuration
```

## License

MIT 