import React, { useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Grid,
  CircularProgress,
  Tooltip,
  List,
  ListItem,
} from '@mui/material';
import { Settings as SettingsIcon, Send as SendIcon } from '@mui/icons-material';
import { BaseNode } from './BaseNode';
import { ImageGenerationNodeData } from '../../types/nodes';
import { useCanvasStore } from '../../store/canvasStore';
import { messageBus } from '../../services/MessageBus';

const IMAGE_MODELS = [
  { value: 'fal-ai/flux', label: 'FLUX', provider: 'fal.ai' }
] as const;

const DEFAULT_SETTINGS = {
  model: 'fal-ai/flux',
  provider: 'fal.ai' as const,
  height: 1024,
  width: 1024,
  guidance_scale: 7.5,
  num_inference_steps: 50,
  negative_prompt: '',
  apiKey: '',
};

export const ImageGenerationNode: React.FC<NodeProps<ImageGenerationNodeData>> = ({ id, data, selected }) => {
  const [prompt, setPrompt] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(data.settings || DEFAULT_SETTINGS);
  const [localApiKey, setLocalApiKey] = useState(data.settings?.apiKey || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const { updateNode } = useCanvasStore();
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSettingsOpen = () => setSettingsOpen(true);
  const handleSettingsClose = () => {
    setLocalSettings(data.settings || DEFAULT_SETTINGS);
    setLocalApiKey(data.settings?.apiKey || '');
    setValidationMessage(null);
    setSettingsOpen(false);
  };

  const validateApiKey = async (apiKey: string) => {
    try {
      const response = await fetch('https://fal.ai/api/v1/models/fal-ai/flux/dev/api', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: "A test prompt for FLUX image generation",
          size: {
            width: localSettings.width,
            height: localSettings.height
          },
          guidance_scale: localSettings.guidance_scale,
          num_inference_steps: localSettings.num_inference_steps
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key. Please check your credentials and try again.');
        }
        throw new Error(error.error || `API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('API validation error:', error);
      throw error;
    }
  };

  const handleSettingsSave = useCallback(async () => {
    if (!localApiKey) {
      updateNode(id, {
        ...data,
        settings: {
          ...localSettings,
          apiKey: ''
        },
      });
      setSettingsOpen(false);
      return;
    }

    setIsValidating(true);
    try {
      await validateApiKey(localApiKey);
      
      updateNode(id, {
        ...data,
        settings: {
          ...localSettings,
          apiKey: localApiKey
        }
      });
      setValidationMessage({ type: 'success', message: 'API key validated successfully!' });
      setSettingsOpen(false);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to validate API key'
      });
    } finally {
      setIsValidating(false);
    }
  }, [id, data, localSettings, localApiKey, updateNode]);

  const handleGenerateImage = useCallback(async () => {
    if (!prompt.trim() || !data.settings?.apiKey) return;

    setIsGenerating(true);
    const imageId = crypto.randomUUID();

    try {
      console.log('Generating image with FLUX:', {
        prompt,
        size: {
          width: data.settings.width,
          height: data.settings.height
        },
        guidance_scale: data.settings.guidance_scale,
        num_inference_steps: data.settings.num_inference_steps,
        negative_prompt: data.settings.negative_prompt
      });

      const response = await fetch('https://fal.ai/api/v1/models/fal-ai/flux/dev/api', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.settings.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          size: {
            width: data.settings.width,
            height: data.settings.height
          },
          guidance_scale: data.settings.guidance_scale,
          num_inference_steps: data.settings.num_inference_steps,
          negative_prompt: data.settings.negative_prompt || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('FLUX API error:', error);
        throw new Error(error.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      const imageUrl = result.image.url; // fal.ai returns a URL to the generated image

      const newImage = {
        id: imageId,
        prompt,
        imageUrl,
        timestamp: Date.now(),
        settings: {
          guidance_scale: data.settings.guidance_scale,
          num_inference_steps: data.settings.num_inference_steps,
          negative_prompt: data.settings.negative_prompt
        }
      };

      const updatedImages = [...(data.images || []), newImage];
      updateNode(id, {
        ...data,
        images: updatedImages,
      });

      messageBus.emit({
        id: imageId,
        eventType: 'message',
        senderId: id,
        receiverId: 'all',
        from: id,
        to: 'all',
        content: imageUrl,
        type: 'image',
        timestamp: Date.now(),
        status: 'sent' as const,
        metadata: {
          prompt,
          nodeId: id,
          messageId: imageId,
          model: data.settings.model,
          settings: {
            height: data.settings.height,
            width: data.settings.width,
            guidance_scale: data.settings.guidance_scale,
            num_inference_steps: data.settings.num_inference_steps,
            negative_prompt: data.settings.negative_prompt
          }
        },
      });

      setPrompt('');
      setValidationMessage(null);
    } catch (error) {
      console.error('Error generating image:', error);
      setValidationMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate image'
      });
    } finally {
      setIsGenerating(false);
    }
  }, [id, data, prompt, updateNode]);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleGenerateImage();
      }
    },
    [handleGenerateImage]
  );

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '300px',
          width: '300px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {IMAGE_MODELS.find(m => m.value === data.settings?.model)?.label || 'Image Generator'}
          </Typography>
          <IconButton size="small" onClick={handleSettingsOpen}>
            <SettingsIcon />
          </IconButton>
        </Box>

        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 0,
          }}
        >
          <List>
            {data.images?.map((image) => (
              <ListItem
                key={image.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  py: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                  {new Date(image.timestamp).toLocaleString()}
                </Typography>
                <Paper
                  sx={{
                    p: 1,
                    bgcolor: 'background.paper',
                    width: '100%',
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {image.prompt}
                  </Typography>
                  {image.settings?.negative_prompt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Negative prompt: {image.settings.negative_prompt}
                    </Typography>
                  )}
                  <Box
                    component="img"
                    src={image.imageUrl}
                    alt={image.prompt}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Settings: {image.settings?.guidance_scale}x guidance, {image.settings?.num_inference_steps} steps
                  </Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        </Paper>

        <Box
          sx={{
            display: 'flex',
            p: 1,
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={data.settings?.apiKey ? "Describe the image you want to generate..." : "Please configure API key in settings..."}
            multiline
            maxRows={4}
            disabled={!data.settings?.apiKey || isGenerating}
          />
          <IconButton
            color="primary"
            onClick={handleGenerateImage}
            disabled={!prompt.trim() || !data.settings?.apiKey || isGenerating}
          >
            {isGenerating ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>

      <Dialog
        open={settingsOpen}
        onClose={handleSettingsClose}
        maxWidth="sm"
        fullWidth
        disablePortal={false}
        container={document.body}
        aria-labelledby="image-settings-title"
        keepMounted={false}
        disableEnforceFocus
      >
        <DialogTitle id="image-settings-title">Image Generation Settings</DialogTitle>
        <DialogContent sx={{ minHeight: '400px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: '400px' }}>
            <FormControl fullWidth>
              <InputLabel id="model-select-label">Model</InputLabel>
              <Select
                labelId="model-select-label"
                value={localSettings.model}
                label="Model"
                onChange={(e) => {
                  const selectedModel = IMAGE_MODELS.find(m => m.value === e.target.value);
                  if (selectedModel) {
                    setLocalSettings({
                      ...localSettings,
                      model: selectedModel.value,
                      provider: selectedModel.provider
                    });
                  }
                }}
              >
                {IMAGE_MODELS.map((model) => (
                  <MenuItem key={model.value} value={model.value}>
                    {model.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                FLUX is a powerful text-to-image generation model
              </Typography>
            </FormControl>

            <TextField
              fullWidth
              label="fal.ai API Key"
              type="password"
              value={localApiKey}
              onChange={(e) => {
                setLocalApiKey(e.target.value);
                if (validationMessage) {
                  setValidationMessage(null);
                }
              }}
              placeholder="Enter your fal.ai API key"
              helperText={
                isValidating ? "Validating API key..." :
                validationMessage ? validationMessage.message :
                "Get your API key from https://fal.ai/dashboard/keys"
              }
              error={validationMessage?.type === 'error'}
              color={validationMessage?.type === 'success' ? 'success' : undefined}
              disabled={isValidating}
            />

            <Box>
              <Typography gutterBottom>Image Size</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Width"
                    value={localSettings.width}
                    onChange={(e) => setLocalSettings({ ...localSettings, width: parseInt(e.target.value) })}
                    inputProps={{ min: 512, max: 2048, step: 64 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Height"
                    value={localSettings.height}
                    onChange={(e) => setLocalSettings({ ...localSettings, height: parseInt(e.target.value) })}
                    inputProps={{ min: 512, max: 2048, step: 64 }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Box>
              <Typography gutterBottom>
                Guidance Scale: {localSettings.guidance_scale}
                <Tooltip title="Higher values make the image more closely match the prompt but may reduce quality" placement="right">
                  <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                    ⓘ
                  </Typography>
                </Tooltip>
              </Typography>
              <Slider
                value={localSettings.guidance_scale}
                onChange={(_, value) => setLocalSettings({ ...localSettings, guidance_scale: value as number })}
                min={1}
                max={20}
                step={0.5}
                marks={[
                  { value: 1, label: '1' },
                  { value: 7.5, label: '7.5' },
                  { value: 20, label: '20' },
                ]}
                aria-label="Guidance Scale"
              />
            </Box>

            <Box>
              <Typography gutterBottom>
                Inference Steps: {localSettings.num_inference_steps}
                <Tooltip title="More steps generally produce better quality but take longer" placement="right">
                  <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                    ⓘ
                  </Typography>
                </Tooltip>
              </Typography>
              <Slider
                value={localSettings.num_inference_steps}
                onChange={(_, value) => setLocalSettings({ ...localSettings, num_inference_steps: value as number })}
                min={10}
                max={150}
                step={1}
                marks={[
                  { value: 10, label: '10' },
                  { value: 50, label: '50' },
                  { value: 150, label: '150' },
                ]}
                aria-label="Inference Steps"
              />
            </Box>

            <TextField
              fullWidth
              label="Negative Prompt"
              value={localSettings.negative_prompt}
              onChange={(e) => setLocalSettings({ ...localSettings, negative_prompt: e.target.value })}
              placeholder="Describe what you don't want in the image"
              helperText="Optional: Specify elements to exclude from the generated image"
              multiline
              maxRows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose} disabled={isValidating}>
            Cancel
          </Button>
          <Button 
            onClick={handleSettingsSave} 
            variant="contained" 
            disabled={isValidating || !localApiKey.trim()}
          >
            {isValidating ? 'Validating...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseNode>
  );
}; 