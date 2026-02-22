import Anthropic from '@anthropic-ai/sdk';

// -- Types -------------------------------------------------------------------

export interface FaceAnalysisData {
  skinTone?: string;
  skinType?: string;
  facialFeatures?: Record<string, unknown>;
  lightingConditions?: string;
  imageResolution?: { width: number; height: number };
  detectedIssues?: string[];
}

export interface BeautySuggestion {
  parameter: string;
  value: number;
  reason: string;
  category: 'skin' | 'lighting' | 'color' | 'detail' | 'artistic';
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  fileSize: number;
  colorSpace?: string;
  exif?: Record<string, unknown>;
  histogram?: Record<string, number[]>;
}

export interface EnhanceParams {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
  highlights: number;
  shadows: number;
  clarity: number;
  vibrance: number;
  exposure: number;
}

export interface EditingTip {
  tip: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  suggestedAction?: string;
}

// -- Client Singleton --------------------------------------------------------

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// -- Low-level helper --------------------------------------------------------

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const claude = getClaude();
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

// -- Rate Limiting (in-memory, per-instance) ---------------------------------

const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
  maxRequests: 50,
  windowMs: 60_000,
};

function checkRateLimit(): void {
  const now = Date.now();

  if (now - rateLimitState.windowStart > rateLimitState.windowMs) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }

  if (rateLimitState.requests >= rateLimitState.maxRequests) {
    throw new Error(
      'AI service rate limit exceeded. Please try again in a moment.',
    );
  }

  rateLimitState.requests++;
}

// -- Parse JSON from response ------------------------------------------------

function parseJsonResponse<T>(text: string): T {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = jsonBlockMatch ? jsonBlockMatch[1]!.trim() : text.trim();

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON. Raw: ${text.substring(0, 200)}`,
    );
  }
}

// -- Beauty Suggestions ------------------------------------------------------

export async function getBeautySuggestions(
  faceAnalysisData: FaceAnalysisData,
): Promise<BeautySuggestion[]> {
  checkRateLimit();

  const systemPrompt = `You are a professional photo retouching and beauty AI assistant for the GlowCam app.
You analyze facial data and suggest precise beauty enhancement parameters.
Always respond with valid JSON only, no additional text.
Each suggestion must have: parameter (string), value (number 0-100), reason (string), and category (one of: skin, lighting, color, detail, artistic).`;

  const userPrompt = `Based on the following face analysis data, provide beauty enhancement suggestions as a JSON array:

${JSON.stringify(faceAnalysisData, null, 2)}

Respond with a JSON array of suggestions. Example format:
[{"parameter": "skin_smoothing", "value": 65, "reason": "Moderate smoothing recommended for natural look", "category": "skin"}]`;

  try {
    const text = await askClaude(systemPrompt, userPrompt, {
      maxTokens: 2048,
      temperature: 0.3,
    });

    return parseJsonResponse<BeautySuggestion[]>(text);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[Claude] API error: ${error.status} - ${error.message}`,
      );
      if (error.status === 429) {
        throw new Error('AI service is temporarily overloaded. Please retry.');
      }
      throw new Error(`AI service error: ${error.message}`);
    }
    throw error;
  }
}

// -- Auto-Enhance Parameters -------------------------------------------------

export async function getAutoEnhanceParams(
  imageMetadata: ImageMetadata,
): Promise<EnhanceParams> {
  checkRateLimit();

  const systemPrompt = `You are a professional photo editor AI for the GlowCam app.
You analyze image metadata and suggest optimal enhancement parameters.
Always respond with valid JSON only, no additional text.
All parameter values must be between -100 and 100 (0 means no change).`;

  const userPrompt = `Based on the following image metadata, provide optimal auto-enhance parameters as a JSON object:

${JSON.stringify(imageMetadata, null, 2)}

Respond with a JSON object containing these exact keys:
brightness, contrast, saturation, warmth, sharpness, highlights, shadows, clarity, vibrance, exposure

Example: {"brightness": 10, "contrast": 15, "saturation": 5, "warmth": -3, "sharpness": 20, "highlights": -10, "shadows": 15, "clarity": 25, "vibrance": 10, "exposure": 5}`;

  try {
    const text = await askClaude(systemPrompt, userPrompt, {
      maxTokens: 2048,
      temperature: 0.2,
    });

    return parseJsonResponse<EnhanceParams>(text);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[Claude] API error: ${error.status} - ${error.message}`,
      );
      if (error.status === 429) {
        throw new Error('AI service is temporarily overloaded. Please retry.');
      }
      throw new Error(`AI service error: ${error.message}`);
    }
    throw error;
  }
}

// -- Editing Tips ------------------------------------------------------------

export async function getEditingTips(
  imageMetadata: ImageMetadata,
  currentParams: Partial<EnhanceParams>,
): Promise<EditingTip[]> {
  checkRateLimit();

  const systemPrompt = `You are a professional photo editing coach for the GlowCam app.
You provide helpful, actionable editing tips based on the current image state and user's editing choices.
Always respond with valid JSON only, no additional text.
Limit to 3-5 most relevant tips.`;

  const userPrompt = `Based on the following image metadata and current editing parameters, provide contextual editing tips as a JSON array:

Image metadata:
${JSON.stringify(imageMetadata, null, 2)}

Current editing parameters:
${JSON.stringify(currentParams, null, 2)}

Respond with a JSON array of tips. Each tip must have: tip (string), priority (high/medium/low), category (string), and optionally suggestedAction (string).

Example: [{"tip": "The shadows are quite dark, consider lifting them for more detail", "priority": "high", "category": "exposure", "suggestedAction": "Increase shadows by 15-20"}]`;

  try {
    const text = await askClaude(systemPrompt, userPrompt, {
      maxTokens: 2048,
      temperature: 0.4,
    });

    return parseJsonResponse<EditingTip[]>(text);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[Claude] API error: ${error.status} - ${error.message}`,
      );
      if (error.status === 429) {
        throw new Error('AI service is temporarily overloaded. Please retry.');
      }
      throw new Error(`AI service error: ${error.message}`);
    }
    throw error;
  }
}
