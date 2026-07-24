import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "gen-lang-client-0014422363",
  appId: "1:978227936883:web:946402bf6886970bc77406",
  apiKey: "AIzaSyAJLNrYkuTt16qs034UlkEBJrMvlrNCnA4",
  authDomain: "gen-lang-client-0014422363.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-29f335c3-c8ac-451f-97d7-9c310736d1d9",
  storageBucket: "gen-lang-client-0014422363.firebasestorage.app",
  messagingSenderId: "978227936883",
  measurementId: ""
};

export interface AIModelOption {
  key: string;      // modelId used in API calls
  name: string;     // display name in dropdown
  category: string; // text_reasoning, image_gen, video_gen, tts
  order: number;
  isDefaultLevel1: boolean;
  isDefaultLevel2: boolean;
}

export interface CentralModelsResult {
  textReasoningModels: AIModelOption[];
  imageModels: AIModelOption[];
  defaultTextModel: string;
  defaultImageModel: string;
}

// Fallback models if Firestore fails or is offline
export const FALLBACK_TEXT_MODELS: AIModelOption[] = [
  { key: 'gemini-3.6-flash', name: '(20)Gemini 3.6 Flash', category: 'text_reasoning', order: 1, isDefaultLevel1: true, isDefaultLevel2: false },
  { key: 'gemini-3.5-flash', name: '(20)Gemini 3.5 Flash', category: 'text_reasoning', order: 2, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3-flash-preview', name: '(20)Gemini 3 Flash Preview', category: 'text_reasoning', order: 3, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.1-pro-preview', name: '(0)Gemini 3.1 Pro Preview', category: 'text_reasoning', order: 4, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.1-flash-lite', name: '(500)Gemini 3.1 Flash Lite', category: 'text_reasoning', order: 5, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-flash-latest', name: 'Gemini Flash Latest', category: 'text_reasoning', order: 6, isDefaultLevel1: false, isDefaultLevel2: false },
];

export const FALLBACK_IMAGE_MODELS: AIModelOption[] = [
  { key: 'gemini-3-pro-image', name: 'Nano Banana Pro (Gemini 3 Pro Image)', category: 'image_gen', order: 1, isDefaultLevel1: true, isDefaultLevel2: false },
  { key: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', category: 'image_gen', order: 2, isDefaultLevel1: false, isDefaultLevel2: true },
  { key: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', category: 'image_gen', order: 3, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-flash-image-latest', name: 'Gemini Flash Image Latest', category: 'image_gen', order: 4, isDefaultLevel1: false, isDefaultLevel2: false },
];

/**
 * Initializes read-only Firebase app and retrieves Firestore database
 */
const getReadonlyFirestore = () => {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
};

/**
 * Fetches active AI models from Firestore collection 'ai_models'
 * App Importance Level: Level 1
 */
export const fetchCentralizedModels = async (): Promise<CentralModelsResult> => {
  try {
    const db = getReadonlyFirestore();
    const querySnapshot = await getDocs(collection(db, "ai_models"));

    const rawModels: AIModelOption[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Filter only active models
      if (data.isActive !== true) return;

      const modelId = data.modelId || doc.id;
      const name = data.name || modelId;
      const category = (data.category || '').toLowerCase();
      const order = typeof data.order === 'number' ? data.order : 999;
      
      const isDefaultLevel1 = data.isDefaultLevel1 === true || data.defaultLevel === 1 || data.defaultForLevel === 'level_1';
      const isDefaultLevel2 = data.isDefaultLevel2 === true || data.defaultLevel === 2 || data.defaultForLevel === 'level_2';

      rawModels.push({
        key: modelId,
        name,
        category,
        order,
        isDefaultLevel1,
        isDefaultLevel2,
      });
    });

    // Separate by category
    const textModels = rawModels
      .filter(m => m.category === 'text_reasoning' || m.category === 'text' || m.category === 'reasoning')
      .sort((a, b) => a.order - b.order);

    const imageModels = rawModels
      .filter(m => m.category === 'image_gen' || m.category === 'image' || m.category === 'image_generation')
      .sort((a, b) => a.order - b.order);

    const finalTexts = textModels.length > 0 ? textModels : FALLBACK_TEXT_MODELS;
    const finalImages = imageModels.length > 0 ? imageModels : FALLBACK_IMAGE_MODELS;

    // Find Level 1 Default model for text reasoning
    const defaultTextObj = finalTexts.find(m => m.isDefaultLevel1) || finalTexts[0];
    const defaultTextModel = defaultTextObj ? defaultTextObj.key : 'gemini-3.6-flash';

    // Find Level 1 Default model for image generation
    const defaultImageObj = finalImages.find(m => m.isDefaultLevel1) || finalImages[0];
    const defaultImageModel = defaultImageObj ? defaultImageObj.key : 'gemini-3-pro-image';

    return {
      textReasoningModels: finalTexts,
      imageModels: finalImages,
      defaultTextModel,
      defaultImageModel,
    };
  } catch (error) {
    console.warn("Failed to fetch central models from Firestore, utilizing fallbacks:", error);
    
    const defaultTextObj = FALLBACK_TEXT_MODELS.find(m => m.isDefaultLevel1) || FALLBACK_TEXT_MODELS[0];
    const defaultImageObj = FALLBACK_IMAGE_MODELS.find(m => m.isDefaultLevel1) || FALLBACK_IMAGE_MODELS[0];

    return {
      textReasoningModels: FALLBACK_TEXT_MODELS,
      imageModels: FALLBACK_IMAGE_MODELS,
      defaultTextModel: defaultTextObj.key,
      defaultImageModel: defaultImageObj.key,
    };
  }
};
