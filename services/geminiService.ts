
// Implement dynamic API key support for standalone deployments
import { GoogleGenAI, Modality, Part } from "@google/genai";
import { STYLE_PROMPT_PREFIXES, ImageStyleKey, ImageModelKey, AspectRatio, StoryLanguageKey, StoryStyleKey, ReasoningModelKey } from "../constants";

// Internal tracker for the active API Key
let currentActiveApiKey = process.env.API_KEY || '';

/**
 * Updates the API key used for all services.
 * Prioritizes keys from the UI notepad.
 */
export const updateActiveApiKey = (key: string) => {
    if (key && key !== 'no API key' && key.trim().length > 0) {
        currentActiveApiKey = key.trim();
    } else {
        currentActiveApiKey = process.env.API_KEY || '';
    }
};

/**
 * Internal helper to get a fresh AI client with the most up-to-date key
 */
const getAi = () => {
    return new GoogleGenAI({ apiKey: currentActiveApiKey });
};

// Helper to parse base64 data URL
const parseDataUrl = (dataUrl: string): { mimeType: string, data: string } => {
    const [header, data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    return { mimeType, data };
};

export const generateFromText = async (
    prompt: string,
    count: 1 | 4,
    aspectRatio: AspectRatio,
    style: ImageStyleKey,
    model: ImageModelKey
): Promise<string[]> => {
    const ai = getAi();
    const fullPrompt = `${STYLE_PROMPT_PREFIXES[style]} ${prompt}`;

    if (model.includes('imagen')) {
        const response = await ai.models.generateImages({
            model,
            prompt: fullPrompt,
            config: {
                numberOfImages: count,
                aspectRatio,
                outputMimeType: 'image/png',
            },
        });
        return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
    } else {
        const response = await ai.models.generateContent({
            model,
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
            throw new Error(`Generation failed. Ensure your API Key is valid and the model supports image generation.`);
        }
        return images;
    }
};

export const generateFromImageAndText = async (prompt: string, referenceImages: string[]): Promise<string[]> => {
    const ai = getAi();
    const parts: Part[] = [];

    for (const refImage of referenceImages) {
        const { mimeType, data } = parseDataUrl(refImage);
        parts.push({ inlineData: { mimeType, data } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
};

export const describeImage = async (imageSrc: string, model: ReasoningModelKey = 'gemini-3-flash-preview'): Promise<string> => {
    const ai = getAi();
    const { mimeType, data } = parseDataUrl(imageSrc);
    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                { inlineData: { mimeType, data } },
                { text: "Describe this image in detail. You must generate a single, complete, and highly optimized image generation prompt designed specifically for Google Gemini / Imagen models. Make it elegant, vivid, and beautifully composed. Do NOT offer multiple choices, options, lists, introductory text, conversational greetings, or any markdown code blocks. Output ONLY the raw final prompt text directly as a single option for image generation." }
            ]
        },
    });
    return response.text || "";
};

export const suggestCaption = async (imageSrc: string, model: ReasoningModelKey = 'gemini-3-flash-preview', maxLength: number = 60): Promise<string> => {
    const ai = getAi();
    const { mimeType, data } = parseDataUrl(imageSrc);
    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                { inlineData: { mimeType, data } },
                { text: `Suggest an engaging caption for this image suitable for social media. Max ${maxLength} characters. Respond with only the caption text.` }
            ]
        },
    });
    return (response.text || "").replace(/["']/g, "");
};

export const enhancePrompt = async (prompt: string, model: ReasoningModelKey = 'gemini-3-flash-preview'): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model,
        contents: `You are an expert image prompt engineer for Gemini and Imagen models. Enhance the following draft prompt into a single, complete, ultra-vivid, beautifully detailed, and highly optimized prompt for Gemini to generate a spectacular image. Do NOT provide multiple options, menus, choices, suggestions, introductory text, explanations, or quotes/markdown. Return ONLY the final complete prompt text directly as a single result.\nDraft prompt: "${prompt}"`,
    });
    return (response.text || "").replace(/["']/g, "");
};

export const generateConcept = async (story: string, model: ReasoningModelKey = 'gemini-3-flash-preview'): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model,
        contents: `You are an expert prompt engineer. Convert the key scene of this story into a single, perfect, and most complete image generation prompt designed specifically for Google Gemini / Imagen models. Focus on aesthetic details, lighting, and composition. Do NOT provide lists, options, choices, suggestions, or introductory commentary. Output ONLY the raw final prompt text directly as a single option.\nStory: "${story}"`,
    });
    return response.text || "";
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
            const { mimeType, data } = parseDataUrl(compositeImageBase64);
            const prompt = `Expand the scene seamlessly to ${targetAspectRatio}. Match original style.`;
            try {
                const ai = getAi();
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ inlineData: { mimeType, data } }, { text: prompt }] },
                });
                const images: string[] = [];
                for (const part of response.candidates?.[0]?.content?.parts ?? []) {
                    if (part.inlineData) {
                        images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    }
                }
                if (images.length > 0) resolve(images);
                else reject(new Error("Expansion failed."));
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
    model: ReasoningModelKey
): Promise<string> => {
    const ai = getAi();
    const langMap: Record<StoryLanguageKey, string> = {
        thai: 'Thai',
        english: 'English',
        contextual: 'contextual',
    };
    const prompt = `Continue this story with ONE sentence. Lang: ${langMap[language]}. Style: ${style}.\nStory: ${story}`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const generateStoryCaption = async (story: string, model: ReasoningModelKey, language: 'English' | 'Thai' = 'English', maxLength: number = 60): Promise<string> => {
    const ai = getAi();
    const lang = language === 'Thai' ? 'Thai' : 'English';
    const prompt = `Create a catchy caption for this story in ${lang}. Max ${maxLength} characters. Respond with only the caption text.\nStory: ${story}`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const polishStory = async (story: string, model: ReasoningModelKey): Promise<string> => {
    const ai = getAi();
    const prompt = `Rewrite this story elegantly. Do not change plot.\nStory: ${story}`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const translateStory = async (story: string, targetLanguage: 'Thai' | 'English', model: ReasoningModelKey): Promise<string> => {
    const ai = getAi();
    const prompt = `Translate this into ${targetLanguage}:\n${story}`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const generateRandomDharma = async (model: ReasoningModelKey): Promise<string> => {
    const ai = getAi();
    const prompt = `คุณคือผู้เชี่ยวชาญในพระไตรปิฎก มีความรู้ความเข้าใจในพระพุทธศาสนาอย่างลึกซึ้ง โปรดสุ่มเลือกคำสอน ธรรมบทสั้นๆ หรือชาดกที่น่าสนใจและมีประโยชน์อย่างมากในการดำเนินชีวิตจากพระไตรปิฎกมา 1 เรื่อง 


ให้อธิบายหลักธรรมคำสอนหรือสรุปเรื่องราวนั้นให้ออกมางดงาม ซาบซึ้ง เข้าใจง่าย และมีพลัง โดยเขียนเป็นข้อความภาษาไทยความยาวประมาณ 2-4 ประโยค 

ข้อสำคัญ: 
- ตอบเฉพาะข้อความเนื้อหาธรรมะ/คำสอนที่สุ่มได้นั้นโดยตรงทันที 
- ไม่ต้องมีคำเกริ่นนำ (เช่น "นี่คือคำสอน..." หรือ "คำสอนที่สุ่มได้คือ...")
- ไม่ต้องมีสัญลักษณ์พิเศษ, markdown backticks, หัวข้อ หรือคำอธิบายเพิ่มเติมใดๆ นอกเหนือจากตัวเนื้อหาธรรมะที่งดงามนั้น`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const generateRandomNews = async (model: ReasoningModelKey): Promise<string> => {
    const ai = getAi();
    const prompt = `คุณคือผู้รอบรู้ในข่าวสารและสถานการณ์ปัจจุบันทั้งในประเทศไทยและรอบโลก มีความเข้าอกเข้าใจในประเด็นที่คนไทยกำลังให้ความสนใจ มีอารมณ์ร่วม หรือได้รับผลกระทบในชีวิตประจำวันอย่างแท้จริง โปรดสุ่มเลือกหรือจำลองประเด็นข่าวดังที่เป็นกระแสร้อนแรงในปัจจุบันมา 1 เรื่อง 

โดยเน้นข่าวทั่วไปที่ส่งผลกระทบต่อชีวิตความเป็นอยู่ ปากท้อง เศรษฐกิจ สังคม สิ่งแวดล้อม หรือข่าวเด่นที่กระทบต่อความรู้สึกของผู้คนในสังคมไทย (เช่น สถานการณ์ค่าครองชีพ, ข่าวเตือนภัยสังคม, การเปลี่ยนแปลงของสภาพภูมิอากาศที่กระทบผู้คน, นวัตกรรมความปลอดภัย, หรือข่าวประเด็นสังคมที่ชวนขบคิดและสร้างแรงกระเพื่อมทางอารมณ์)

สรุปเนื้อหาข่าวเรื่องนั้นให้เป็นย่อหน้าที่น่าอ่าน กระชับ เข้าถึงความรู้สึกจริง ทรงพลัง และเข้าใจง่าย โดยเขียนเป็นภาษาไทยความยาวประมาณ 2-4 ประโยค

ข้อสำคัญ:
- ตอบเฉพาะส่วนเนื้อข่าวสรุปโดยตรงทันที
- ไม่ต้องมีคำเกริ่นนำ (เช่น "นี่คือข่าวที่สุ่มได้..." หรือ "รายงานข่าวด่วนวันนี้...")
- ไม่ต้องมีเครื่องหมายคำพูดพิเศษ, markdown backticks, หรือสัญลักษณ์ประดับเพิ่มเติมใดๆ ทั้งสิ้น`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};

export const generateDesignFromStory = async (story: string, styleName: string, model: ReasoningModelKey): Promise<string> => {
    const ai = getAi();
    const prompt = `You are an expert prompt engineer. Create a single, perfect, and complete text-to-image prompt based on this story in ${styleName} style, optimized specifically for image generation with Google Gemini / Imagen. Do NOT offer choices, options, intros, explanation, or markdown backticks/blocks. Output exactly one highly optimized option directly.\nStory: ${story}`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return (response.text || "").trim();
};
