// Dual-Layer Resilient Gemini AI Engine with Smart Cascade Fallback & Future-Proof Model Registry
import { GoogleGenAI, Part } from "@google/genai";
import { 
    STYLE_PROMPT_PREFIXES, 
    ImageStyleKey, 
    ImageModelKey, 
    AspectRatio, 
    StoryLanguageKey, 
    StoryStyleKey, 
    ReasoningModelKey 
} from "../constants";
import { 
    buildSmartFallbackCascade, 
    resolveModelName 
} from "./centralModelService";
import { 
    shouldUseDirectClientCalls, 
    isAiStudioEnvironment 
} from "../utils/environmentUtils";
import { aiLogService } from "./aiLogService";

// Internal tracker for the active API Key
let currentActiveApiKey = typeof window !== 'undefined' ? (localStorage.getItem('user_api_key') || '') : '';

/**
 * Updates the API key used for all services.
 * Prioritizes keys from the UI / LocalStorage.
 */
export const updateActiveApiKey = (key: string) => {
    if (key && key !== 'no API key' && key.trim().length > 0) {
        currentActiveApiKey = key.trim();
    } else {
        currentActiveApiKey = process.env.API_KEY || '';
    }
};

export const getActiveApiKey = (): string => {
    return currentActiveApiKey;
};

/**
 * Internal helper to get a fresh AI client with the most up-to-date key
 */
const getAi = () => {
    return new GoogleGenAI({ apiKey: currentActiveApiKey });
};

// Helper to parse base64 data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    const [header, data] = dataUrl.split(',');
    const mimeType = header?.match(/:(.*?);/)?.[1] ?? 'image/png';
    return { mimeType, data: data || '' };
};

/**
 * Executes a client-side call with smart cascade fallback and execution tracking
 */
async function runWithClientCascade<T>(
    actionName: string,
    requestedModel: string,
    taskType: 'text' | 'image',
    executor: (ai: GoogleGenAI, model: string) => Promise<T>
): Promise<T> {
    const startTime = Date.now();
    const modelsToTry = buildSmartFallbackCascade(requestedModel, taskType);
    const fallbackPath: string[] = [];
    let lastError: Error | null = null;
    const ai = getAi();

    for (const model of modelsToTry) {
        try {
            fallbackPath.push(model);
            const result = await executor(ai, model);
            const latencyMs = Date.now() - startTime;
            const fallbackOccurred = model !== requestedModel;

            aiLogService.addLog({
                action: actionName,
                requestedModel,
                actualModel: model,
                fallbackOccurred,
                fallbackPath,
                latencyMs,
                keySource: currentActiveApiKey ? 'client-storage' : 'server-env',
                status: fallbackOccurred ? 'fallback_success' : 'success',
                environment: 'direct-client',
                summary: `Successfully completed via ${model} in ${latencyMs}ms`
            });

            return result;
        } catch (err: any) {
            lastError = err;
            console.warn(`[Client Cascade] Model '${model}' failed: ${err.message || err}. Cascade advancing...`);
        }
    }

    const latencyMs = Date.now() - startTime;
    aiLogService.addLog({
        action: actionName,
        requestedModel,
        actualModel: 'none',
        fallbackOccurred: true,
        fallbackPath,
        latencyMs,
        keySource: currentActiveApiKey ? 'client-storage' : 'server-env',
        status: 'error',
        environment: 'direct-client',
        errorDetails: lastError?.message || 'Cascade exhausted',
        summary: `Failed after attempting ${fallbackPath.length} models: ${lastError?.message}`
    });

    throw lastError || new Error(`All models failed for action '${actionName}'.`);
}

/**
 * Text & Story Generation with Dual-Layer Routing (Proxy vs Direct)
 */
async function executeTextTask(
    actionName: string,
    prompt: string,
    requestedModel: ReasoningModelKey = 'gemini-3.6-flash',
    systemInstruction?: string
): Promise<string> {
    const useDirect = shouldUseDirectClientCalls();

    if (!useDirect) {
        // AI Studio Environment: Route via Server-Side Proxy
        const startTime = Date.now();
        try {
            const res = await fetch('/api/ai/generate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': currentActiveApiKey || ''
                },
                body: JSON.stringify({
                    prompt,
                    model: requestedModel,
                    systemInstruction
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `Server responded with ${res.status}`);
            }

            aiLogService.addLog({
                action: actionName,
                requestedModel,
                actualModel: data.actualModel || requestedModel,
                fallbackOccurred: Boolean(data.fallbackOccurred),
                fallbackPath: data.fallbackPath || [requestedModel],
                latencyMs: data.latencyMs || (Date.now() - startTime),
                keySource: data.keySource || 'server-env',
                status: data.fallbackOccurred ? 'fallback_success' : 'success',
                environment: 'ai-studio-proxy',
                summary: `Generated via server proxy (${data.actualModel || requestedModel})`
            });

            return data.text || '';
        } catch (error: any) {
            console.warn(`[Proxy Attempt Failed] Switching to direct client fallback:`, error.message);
            // Fallback to direct client if proxy is unavailable
            return runWithClientCascade(actionName, requestedModel, 'text', async (ai, model) => {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: systemInstruction ? { systemInstruction } : undefined
                });
                return response.text || '';
            });
        }
    }

    // Direct Client Mode
    return runWithClientCascade(actionName, requestedModel, 'text', async (ai, model) => {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: systemInstruction ? { systemInstruction } : undefined
        });
        return response.text || '';
    });
}

export const generateFromText = async (
    prompt: string,
    count: 1 | 4,
    aspectRatio: AspectRatio,
    style: ImageStyleKey,
    model: ImageModelKey
): Promise<string[]> => {
    const fullPrompt = `${STYLE_PROMPT_PREFIXES[style]} ${prompt}`;
    const useDirect = shouldUseDirectClientCalls();

    if (!useDirect) {
        const startTime = Date.now();
        try {
            const res = await fetch('/api/ai/generate-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': currentActiveApiKey || ''
                },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    model,
                    count,
                    aspectRatio
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `Server responded with ${res.status}`);
            }

            aiLogService.addLog({
                action: 'generateFromText',
                requestedModel: model,
                actualModel: data.actualModel || model,
                fallbackOccurred: Boolean(data.fallbackOccurred),
                fallbackPath: data.fallbackPath || [model],
                latencyMs: data.latencyMs || (Date.now() - startTime),
                keySource: data.keySource || 'server-env',
                status: data.fallbackOccurred ? 'fallback_success' : 'success',
                environment: 'ai-studio-proxy',
                summary: `Images generated using ${data.actualModel || model}`
            });

            return data.images || [];
        } catch (error: any) {
            console.warn("[Proxy Image Fail] Falling back to direct client execution:", error);
        }
    }

    return runWithClientCascade('generateFromText', model, 'image', async (ai, activeModel) => {
        if (activeModel.includes('imagen')) {
            const response = await ai.models.generateImages({
                model: activeModel,
                prompt: fullPrompt,
                config: {
                    numberOfImages: count,
                    aspectRatio,
                    outputMimeType: 'image/png',
                },
            });
            return (response.generatedImages || []).map(img => `data:image/png;base64,${img.image.imageBytes}`);
        } else {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: { parts: [{ text: fullPrompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                    }
                },
            });
            
            const images: string[] = [];
            for (const part of response.candidates?.[0]?.content?.parts ?? []) {
                if (part.inlineData) {
                    images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                }
            }
            if (images.length === 0) {
                throw new Error(`Generation failed for model ${activeModel}.`);
            }
            return images;
        }
    });
};

export const generateFromImageAndText = async (prompt: string, referenceImages: string[]): Promise<string[]> => {
    const useDirect = shouldUseDirectClientCalls();
    const targetModel = 'gemini-3.1-flash-image';

    if (!useDirect) {
        const startTime = Date.now();
        try {
            const res = await fetch('/api/ai/generate-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': currentActiveApiKey || ''
                },
                body: JSON.stringify({
                    prompt,
                    model: targetModel,
                    referenceImages
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate image from reference');
            }

            aiLogService.addLog({
                action: 'generateFromImageAndText',
                requestedModel: targetModel,
                actualModel: data.actualModel || targetModel,
                fallbackOccurred: Boolean(data.fallbackOccurred),
                fallbackPath: data.fallbackPath || [targetModel],
                latencyMs: data.latencyMs || (Date.now() - startTime),
                keySource: data.keySource || 'server-env',
                status: 'success',
                environment: 'ai-studio-proxy'
            });

            return data.images || [];
        } catch (e) {
            console.warn('[Proxy Ref Gen Fail] Fallback to direct client', e);
        }
    }

    return runWithClientCascade('generateFromImageAndText', targetModel, 'image', async (ai, model) => {
        const parts: Part[] = [];
        for (const refImage of referenceImages) {
            const { mimeType, data } = parseDataUrl(refImage);
            parts.push({ inlineData: { mimeType, data } });
        }
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model,
            contents: { parts },
        });

        const images: string[] = [];
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            }
        }
        if (images.length === 0) {
            throw new Error("Generation failed. No image returned.");
        }
        return images;
    });
};

export const describeImage = async (imageSrc: string, model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = "Describe this image in detail. You must generate a single, complete, and highly optimized image generation prompt designed specifically for Google Gemini / Imagen models. Make it elegant, vivid, and beautifully composed. Do NOT offer multiple choices, options, lists, introductory text, conversational greetings, or any markdown code blocks. Output ONLY the raw final prompt text directly as a single option for image generation.";
    const useDirect = shouldUseDirectClientCalls();

    if (!useDirect) {
        const startTime = Date.now();
        try {
            const res = await fetch('/api/ai/describe-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': currentActiveApiKey || ''
                },
                body: JSON.stringify({
                    imageSrc,
                    prompt,
                    model
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to describe image');

            aiLogService.addLog({
                action: 'describeImage',
                requestedModel: model,
                actualModel: data.actualModel || model,
                fallbackOccurred: Boolean(data.fallbackOccurred),
                fallbackPath: data.fallbackPath || [model],
                latencyMs: data.latencyMs || (Date.now() - startTime),
                keySource: data.keySource || 'server-env',
                status: 'success',
                environment: 'ai-studio-proxy'
            });

            return data.text || '';
        } catch (e) {
            console.warn('[Proxy Describe Fail] Direct client fallback', e);
        }
    }

    return runWithClientCascade('describeImage', model, 'text', async (ai, activeModel) => {
        const { mimeType, data } = parseDataUrl(imageSrc);
        const response = await ai.models.generateContent({
            model: activeModel,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            },
        });
        return response.text || "";
    });
};

export const suggestCaption = async (imageSrc: string, model: ReasoningModelKey = 'gemini-3.6-flash', maxLength: number = 60): Promise<string> => {
    const prompt = `Suggest an engaging caption for this image suitable for social media. Max ${maxLength} characters. Respond with only the caption text.`;
    const useDirect = shouldUseDirectClientCalls();

    if (!useDirect) {
        const startTime = Date.now();
        try {
            const res = await fetch('/api/ai/describe-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': currentActiveApiKey || ''
                },
                body: JSON.stringify({
                    imageSrc,
                    prompt,
                    model
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to suggest caption');

            aiLogService.addLog({
                action: 'suggestCaption',
                requestedModel: model,
                actualModel: data.actualModel || model,
                fallbackOccurred: Boolean(data.fallbackOccurred),
                fallbackPath: data.fallbackPath || [model],
                latencyMs: data.latencyMs || (Date.now() - startTime),
                keySource: data.keySource || 'server-env',
                status: 'success',
                environment: 'ai-studio-proxy'
            });

            return (data.text || "").replace(/["']/g, "");
        } catch (e) {
            console.warn('[Proxy Caption Fail] Direct client fallback', e);
        }
    }

    return runWithClientCascade('suggestCaption', model, 'text', async (ai, activeModel) => {
        const { mimeType, data } = parseDataUrl(imageSrc);
        const response = await ai.models.generateContent({
            model: activeModel,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            },
        });
        return (response.text || "").replace(/["']/g, "");
    });
};

export const enhancePrompt = async (prompt: string, model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const systemPrompt = `You are an expert image prompt engineer for Gemini and Imagen models. Enhance the following draft prompt into a single, complete, ultra-vivid, beautifully detailed, and highly optimized prompt for Gemini to generate a spectacular image. Do NOT provide multiple options, menus, choices, suggestions, introductory text, explanations, or quotes/markdown. Return ONLY the final complete prompt text directly as a single result.\nDraft prompt: "${prompt}"`;
    const result = await executeTextTask('enhancePrompt', systemPrompt, model);
    return result.replace(/["']/g, "").trim();
};

export const generateConcept = async (story: string, model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `You are an expert prompt engineer. Convert the key scene of this story into a single, perfect, and most complete image generation prompt designed specifically for Google Gemini / Imagen models. Focus on aesthetic details, lighting, and composition. Do NOT provide lists, options, choices, suggestions, or introductory commentary. Output ONLY the raw final prompt text directly as a single option.\nStory: "${story}"`;
    return executeTextTask('generateConcept', prompt, model);
};

export const expandImage = (imageSrc: string, targetAspectRatio: AspectRatio): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            const originalWidth = img.width;
            const originalHeight = img.height;
            const originalRatio = originalWidth / originalHeight;
            const [targetW, targetH] = targetAspectRatio.split(':').map(Number);
            const targetRatio = targetW / targetH;
            const canvas = document.createElement('canvas');
            let xOffset = 0;
            let yOffset = 0;
            if (targetRatio > originalRatio) {
                canvas.height = originalHeight;
                canvas.width = Math.round(originalHeight * targetRatio);
                xOffset = (canvas.width - originalWidth) / 2;
                yOffset = 0;
            } else {
                canvas.width = originalWidth;
                canvas.height = Math.round(originalWidth / targetRatio);
                xOffset = 0;
                yOffset = (canvas.height - originalHeight) / 2;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            ctx.drawImage(img, xOffset, yOffset, originalWidth, originalHeight);
            const compositeImageBase64 = canvas.toDataURL('image/png');
            const prompt = `Expand the scene seamlessly to ${targetAspectRatio}. Match original style.`;
            
            try {
                const images = await generateFromImageAndText(prompt, [compositeImageBase64]);
                resolve(images);
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = imageSrc;
    });
};

export const generateNextSentence = async (
    story: string,
    language: StoryLanguageKey,
    style: StoryStyleKey,
    model: ReasoningModelKey = 'gemini-3.6-flash'
): Promise<string> => {
    const langMap: Record<StoryLanguageKey, string> = {
        thai: 'Thai',
        english: 'English',
        contextual: 'contextual',
    };
    const prompt = `Continue this story with ONE sentence. Lang: ${langMap[language]}. Style: ${style}.\nStory: ${story}`;
    const result = await executeTextTask('generateNextSentence', prompt, model);
    return result.trim();
};

export const generateStoryCaption = async (
    story: string, 
    model: ReasoningModelKey = 'gemini-3.6-flash', 
    language: 'English' | 'Thai' = 'English', 
    maxLength: number = 60
): Promise<string> => {
    const lang = language === 'Thai' ? 'Thai' : 'English';
    const prompt = `Create a catchy caption for this story in ${lang}. Max ${maxLength} characters. Respond with only the caption text.\nStory: ${story}`;
    const result = await executeTextTask('generateStoryCaption', prompt, model);
    return result.trim();
};

export const polishStory = async (story: string, model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `Rewrite this story elegantly. Do not change plot.\nStory: ${story}`;
    const result = await executeTextTask('polishStory', prompt, model);
    return result.trim();
};

export const translateStory = async (story: string, targetLanguage: 'Thai' | 'English', model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `Translate this into ${targetLanguage}:\n${story}`;
    const result = await executeTextTask('translateStory', prompt, model);
    return result.trim();
};

export const generateRandomDharma = async (model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `คุณคือผู้เชี่ยวชาญในพระไตรปิฎก มีความรู้ความเข้าใจในพระพุทธศาสนาอย่างลึกซึ้ง โปรดสุ่มเลือกคำสอน ธรรมบทสั้นๆ หรือชาดกที่น่าสนใจและมีประโยชน์อย่างมากในการดำเนินชีวิตจากพระไตรปิฎกมา 1 เรื่อง 

ให้อธิบายหลักธรรมคำสอนหรือสรุปเรื่องราวนั้นให้ออกมางดงาม ซาบซึ้ง เข้าใจง่าย และมีพลัง โดยเขียนเป็นข้อความภาษาไทยความยาวประมาณ 2-4 ประโยค 

ข้อสำคัญ: 
- ตอบเฉพาะข้อความเนื้อหาธรรมะ/คำสอนที่สุ่มได้นั้นโดยตรงทันที 
- ไม่ต้องมีคำเกริ่นนำ (เช่น "นี่คือคำสอน..." หรือ "คำสอนที่สุ่มได้คือ...")
- ไม่ต้องมีสัญลักษณ์พิเศษ, markdown backticks, หัวข้อ หรือคำอธิบายเพิ่มเติมใดๆ นอกเหนือจากตัวเนื้อหาธรรมะที่งดงามนั้น`;
    const result = await executeTextTask('generateRandomDharma', prompt, model);
    return result.trim();
};

export const generateRandomNews = async (model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `คุณคือผู้รอบรู้ในข่าวสารและสถานการณ์ปัจจุบันทั้งในประเทศไทยและรอบโลก มีความเข้าอกเข้าใจในประเด็นที่คนไทยกำลังให้ความสนใจ มีอารมณ์ร่วม หรือได้รับผลกระทบในชีวิตประจำวันอย่างแท้จริง โปรดสุ่มเลือกหรือจำลองประเด็นข่าวดังที่เป็นกระแสร้อนแรงในปัจจุบันมา 1 เรื่อง 

โดยเน้นข่าวทั่วไปที่ส่งผลกระทบต่อชีวิตความเป็นอยู่ ปากท้อง เศรษฐกิจ สังคม สิ่งแวดล้อม หรือข่าวเด่นที่กระทบต่อความรู้สึกของผู้คนในสังคมไทย (เช่น สถานการณ์ค่าครองชีพ, ข่าวเตือนภัยสังคม, การเปลี่ยนแปลงของสภาพภูมิอากาศที่กระทบผู้คน, นวัตกรรมความปลอดภัย, หรือข่าวประเด็นสังคมที่ชวนขบคิดและสร้างแรงกระเพื่อมทางอารมณ์)

สรุปเนื้อหาข่าวเรื่องนั้นให้เป็นย่อหน้าที่น่าอ่าน กระชับ เข้าถึงความรู้สึกจริง ทรงพลัง และเข้าใจง่าย โดยเขียนเป็นภาษาไทยความยาวประมาณ 2-4 ประโยค

ข้อสำคัญ:
- ตอบเฉพาะส่วนเนื้อข่าวสรุปโดยตรงทันที
- ไม่ต้องมีคำเกริ่นนำ (เช่น "นี่คือข่าวที่สุ่มได้..." หรือ "รายงานข่าวด่วนวันนี้...")
- ไม่ต้องมีเครื่องหมายคำพูดพิเศษ, markdown backticks, หรือสัญลักษณ์ประดับเพิ่มเติมใดๆ ทั้งสิ้น`;
    const result = await executeTextTask('generateRandomNews', prompt, model);
    return result.trim();
};

export const generateDesignFromStory = async (story: string, styleName: string, model: ReasoningModelKey = 'gemini-3.6-flash'): Promise<string> => {
    const prompt = `You are an expert prompt engineer. Create a single, perfect, and complete text-to-image prompt based on this story in ${styleName} style, optimized specifically for image generation with Google Gemini / Imagen. Do NOT offer choices, options, intros, explanation, or markdown backticks/blocks. Output exactly one highly optimized option directly.\nStory: ${story}`;
    const result = await executeTextTask('generateDesignFromStory', prompt, model);
    return result.trim();
};

/**
 * Utility to test API Key validity directly
 */
export const testGeminiApiKey = async (apiKey: string): Promise<{ valid: boolean; message: string; modelUsed?: string }> => {
    if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, message: 'API key is too short or empty.' };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const res = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: 'ping'
        });
        if (res.text) {
            return { valid: true, message: 'API Key is verified and fully operational!', modelUsed: 'gemini-3.6-flash' };
        }
        return { valid: true, message: 'API Key responded successfully.' };
    } catch (err: any) {
        return { valid: false, message: err?.message || 'Verification failed.' };
    }
};
