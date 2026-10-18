import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Part } from '@google/genai';
import { buildSmartFallbackCascade, resolveModelName } from './services/centralModelService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON body parser with increased limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

/**
 * Multi-Source Key Resolution
 * 1) Request header 'x-gemini-api-key'
 * 2) Server Environment 'GEMINI_API_KEY'
 * 3) Server Environment 'API_KEY'
 */
const resolveApiKey = (req: Request): { key: string; source: 'client-header' | 'server-env' } => {
  const headerKey = req.headers['x-gemini-api-key'] as string;
  if (headerKey && headerKey.trim().length > 5 && headerKey !== 'no API key' && headerKey !== 'PLACEHOLDER_API_KEY') {
    return { key: headerKey.trim(), source: 'client-header' };
  }

  const serverEnvKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (serverEnvKey && serverEnvKey.trim().length > 5 && serverEnvKey !== 'PLACEHOLDER_API_KEY') {
    return { key: serverEnvKey.trim(), source: 'server-env' };
  }

  return { key: '', source: 'server-env' };
};

// Helper to parse base64 data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
  const [header, data] = dataUrl.split(',');
  const mimeType = header?.match(/:(.*?);/)?.[1] ?? 'image/png';
  return { mimeType, data: data || '' };
};

// Health Check Endpoint
app.get('/api/ai/health', (req: Request, res: Response) => {
  const { key, source } = resolveApiKey(req);
  res.json({
    status: 'ok',
    hasKey: Boolean(key),
    keySource: key ? source : 'none',
    timestamp: Date.now(),
    server: 'Dual-Layer Resilient Gemini Engine Proxy'
  });
});

/**
 * Text & Reasoning Generation Endpoint with Smart Cascade Fallback
 */
app.post('/api/ai/generate-text', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { prompt, model: requestedModel = 'gemini-3.6-flash', systemInstruction } = req.body;
  const { key: apiKey, source: keySource } = resolveApiKey(req);

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Gemini API Key is missing. Please provide it via the API key input in the UI.'
    });
  }

  const modelsToTry = buildSmartFallbackCascade(requestedModel, 'text');
  const fallbackPath: string[] = [];
  let lastError: Error | null = null;
  const ai = new GoogleGenAI({ apiKey });

  for (const model of modelsToTry) {
    try {
      fallbackPath.push(model);
      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: Object.keys(config).length > 0 ? config : undefined
      });

      const text = response.text || '';
      const latencyMs = Date.now() - startTime;
      const fallbackOccurred = model !== requestedModel;

      return res.json({
        text,
        requestedModel,
        actualModel: model,
        fallbackOccurred,
        fallbackPath,
        latencyMs,
        keySource
      });
    } catch (err: any) {
      lastError = err;
      console.warn(`[Proxy Fallback] Model '${model}' failed: ${err.message || err}. Trying next fallback in cascade...`);
    }
  }

  const latencyMs = Date.now() - startTime;
  res.status(500).json({
    error: lastError?.message || 'All cascade fallback models failed.',
    requestedModel,
    fallbackPath,
    latencyMs,
    keySource
  });
});

/**
 * Image Generation Endpoint with Smart Cascade Fallback
 */
app.post('/api/ai/generate-images', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const {
    prompt,
    model: requestedModel = 'gemini-3-pro-image',
    count = 1,
    aspectRatio = '16:9',
    referenceImages = []
  } = req.body;
  const { key: apiKey, source: keySource } = resolveApiKey(req);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Gemini API Key is missing. Please provide it in the API key input.'
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const hasReferences = Array.isArray(referenceImages) && referenceImages.length > 0;
  const modelsToTry = buildSmartFallbackCascade(requestedModel, 'image');
  const fallbackPath: string[] = [];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      fallbackPath.push(model);
      const isImagen = model.toLowerCase().includes('imagen');

      if (hasReferences) {
        // Image + Text reference generation
        const parts: Part[] = [];
        for (const refImage of referenceImages) {
          const { mimeType, data } = parseDataUrl(refImage);
          parts.push({ inlineData: { mimeType, data } });
        }
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
          model,
          contents: { parts }
        });

        const images: string[] = [];
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData) {
            images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
          }
        }

        if (images.length === 0) {
          throw new Error(`Model ${model} did not return image data.`);
        }

        return res.json({
          images,
          requestedModel,
          actualModel: model,
          fallbackOccurred: model !== requestedModel,
          fallbackPath,
          latencyMs: Date.now() - startTime,
          keySource
        });
      } else if (isImagen) {
        // Imagen 3/4 Image Generation API
        const response = await ai.models.generateImages({
          model,
          prompt,
          config: {
            numberOfImages: (count === 4 ? 4 : 1) as any,
            aspectRatio: aspectRatio as any,
            outputMimeType: 'image/png'
          }
        });

        const images = (response.generatedImages || []).map(
          img => `data:image/png;base64,${img.image.imageBytes}`
        );

        if (images.length === 0) {
          throw new Error(`Model ${model} returned zero images.`);
        }

        return res.json({
          images,
          requestedModel,
          actualModel: model,
          fallbackOccurred: model !== requestedModel,
          fallbackPath,
          latencyMs: Date.now() - startTime,
          keySource
        });
      } else {
        // Gemini Multimodal Image Generation
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any
            }
          }
        });

        const images: string[] = [];
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData) {
            images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
          }
        }

        if (images.length === 0) {
          throw new Error(`Model ${model} returned no inline image bytes.`);
        }

        return res.json({
          images,
          requestedModel,
          actualModel: model,
          fallbackOccurred: model !== requestedModel,
          fallbackPath,
          latencyMs: Date.now() - startTime,
          keySource
        });
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Proxy Fallback] Image Model '${model}' failed: ${err.message || err}. Trying next fallback...`);
    }
  }

  res.status(500).json({
    error: lastError?.message || 'All cascade fallback image models failed.',
    requestedModel,
    fallbackPath,
    latencyMs: Date.now() - startTime,
    keySource
  });
});

/**
 * Image Description & Multimodal Endpoint with Fallback
 */
app.post('/api/ai/describe-image', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { imageSrc, prompt, model: requestedModel = 'gemini-3.6-flash' } = req.body;
  const { key: apiKey, source: keySource } = resolveApiKey(req);

  if (!imageSrc || !prompt) {
    return res.status(400).json({ error: 'Image and prompt are required.' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Gemini API Key is missing.' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const { mimeType, data } = parseDataUrl(imageSrc);
  const modelsToTry = buildSmartFallbackCascade(requestedModel, 'text');
  const fallbackPath: string[] = [];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      fallbackPath.push(model);
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt }
          ]
        }
      });

      return res.json({
        text: response.text || '',
        requestedModel,
        actualModel: model,
        fallbackOccurred: model !== requestedModel,
        fallbackPath,
        latencyMs: Date.now() - startTime,
        keySource
      });
    } catch (err: any) {
      lastError = err;
      console.warn(`[Proxy Fallback] Vision Model '${model}' failed: ${err.message || err}. Trying next...`);
    }
  }

  res.status(500).json({
    error: lastError?.message || 'All vision fallback models failed.',
    requestedModel,
    fallbackPath,
    latencyMs: Date.now() - startTime,
    keySource
  });
});

// Setup Vite Dev Middleware or Static Serving
const setupServer = async () => {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
};

setupServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
