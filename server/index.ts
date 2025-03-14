import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Replicate from 'replicate';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Generate text endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, options } = req.body;
    
    // Create a new Replicate instance with the provided API key
    const replicate = new Replicate({
      auth: options.apiKey || process.env.REPLICATE_API_TOKEN,
    });

    // Map model IDs to their full Replicate model identifiers
    const modelMap: Record<string, `${string}/${string}:${string}`> = {
      'gemma-3-27b-it': 'google-deepmind/gemma-3-27b-it:7c5c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0',
      'gemma-3-7b-it': 'google-deepmind/gemma-3-7b-it:7c5c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0',
      'gemma-2-27b-it': 'google-deepmind/gemma-2-27b-it:7c5c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0',
      'gemma-2-7b-it': 'google-deepmind/gemma-2-7b-it:7c5c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0',
    };

    const modelId = options.model || 'gemma-3-27b-it';
    const modelIdentifier = modelMap[modelId];

    if (!modelIdentifier) {
      throw new Error(`Invalid model: ${modelId}`);
    }

    const output = await replicate.run(
      modelIdentifier,
      {
        input: {
          prompt,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
          repetition_penalty: options.repetitionPenalty || 1.1,
        }
      }
    );
    res.json({ result: output });
  } catch (error) {
    console.error('Error generating text:', error);
    res.status(500).json({ error: 'Failed to generate text' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 