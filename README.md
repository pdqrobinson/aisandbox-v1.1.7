# AI Sandbox

A node-based sandbox environment for AI interactions and content processing.

## Features

- **Chat Node**: Interactive AI chat interface with support for multiple AI providers (Cohere, DeepSeek)
- **URL Node**: Process and analyze web content
- **Notes Node**: Create and manage notes from chat interactions
- **Node Communication**: Real-time communication between different node types
- **Dynamic Context**: Automatic context management based on connected nodes
- **Note-Taking Mode**: Dedicated mode for converting chat interactions into structured notes

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Create a `.env` file
   - Add your API keys:
     ```
     COHERE_API_KEY=your_cohere_key
     GITHUB_TOKEN=your_github_token  # For DeepSeek
     ```

## Usage

1. Start the development server:
   ```bash
   npm start
   ```
2. Open your browser to the displayed URL
3. Create nodes by dragging them from the toolbar
4. Connect nodes by dragging between their ports
5. Configure the Chat Node with your API keys in settings

## Node Types

### Chat Node
- AI-powered chat interface
- Supports multiple AI providers
- Context-aware responses based on connected nodes
- Note-taking mode for structured content

### URL Node
- Process web content
- Extract metadata (title, description)
- Share content with connected nodes

### Notes Node
- Create and manage notes
- Receive content from Chat Node
- Structured note storage

## Development

- Built with React and TypeScript
- Uses Material-UI for components
- Real-time node communication system
- Extensible node architecture

## License

MIT License 