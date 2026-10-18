import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';

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
  isLiveSynced?: boolean;
}

// Fallback models if Firestore fails or is offline
export const FALLBACK_TEXT_MODELS: AIModelOption[] = [
  { key: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (High Speed)', category: 'text_reasoning', order: 1, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Workhorse)', category: 'text_reasoning', order: 2, isDefaultLevel1: true, isDefaultLevel2: false },
  { key: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'text_reasoning', order: 3, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', category: 'text_reasoning', order: 4, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Deep Reasoning)', category: 'text_reasoning', order: 5, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Max Quota)', category: 'text_reasoning', order: 6, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', category: 'text_reasoning', order: 7, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-flash-latest', name: 'Gemini Flash Latest', category: 'text_reasoning', order: 8, isDefaultLevel1: false, isDefaultLevel2: false },
];

export const FALLBACK_IMAGE_MODELS: AIModelOption[] = [
  { key: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image (Nano Banana Pro)', category: 'image_gen', order: 1, isDefaultLevel1: true, isDefaultLevel2: false },
  { key: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)', category: 'image_gen', order: 2, isDefaultLevel1: false, isDefaultLevel2: true },
  { key: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', category: 'image_gen', order: 3, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'imagen-4.0-generate-001', name: 'Imagen 4 Generate', category: 'image_gen', order: 4, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra Generate', category: 'image_gen', order: 5, isDefaultLevel1: false, isDefaultLevel2: false },
  { key: 'gemini-flash-image-latest', name: 'Gemini Flash Image Latest', category: 'image_gen', order: 6, isDefaultLevel1: false, isDefaultLevel2: false },
];

/**
 * Initializes read-only Firebase app and retrieves Firestore database
 */
export const getReadonlyFirestore = () => {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
};

/**
 * 1. Future-Proof Model Passthrough & Sanitization (Requirement 1)
 * 
 * Rules:
 * - If matching standardized pattern (/^gemini-[a-z0-9.-]+$/i or /^imagen-[a-z0-9.-]+$/i)
 *   including future releases like gemini-3.9-*, gemini-4.0-*, gemini-4.5-*, KEEP 100% UNCHANGED.
 *   Never convert or downgrade future models!
 * - Deprecated models that Google officially sunsetted (1.5, 2.0 legacy):
 *   Convert to current stable equivalent to prevent 404 errors.
 */
export const resolveModelName = (requestedModel: string): string => {
  if (!requestedModel || typeof requestedModel !== 'string') {
    return 'gemini-3.6-flash';
  }

  const trimmed = requestedModel.trim();
  const lower = trimmed.toLowerCase();

  // Known deprecated models sunsetted by Google
  const deprecatedMap: Record<string, string> = {
    'gemini-1.5-flash': 'gemini-3.6-flash',
    'gemini-1.5-flash-8b': 'gemini-3.5-flash-lite',
    'gemini-1.5-pro': 'gemini-3.1-pro-preview',
    'gemini-2.0-flash': 'gemini-3.6-flash',
    'gemini-2.0-flash-exp': 'gemini-3.6-flash',
    'gemini-2.0-flash-thinking-exp': 'gemini-3.1-pro-preview',
    'gemini-2.0-flash-thinking-exp-01-21': 'gemini-3.1-pro-preview',
    'gemini-2.0-pro-exp-02-05': 'gemini-3.1-pro-preview',
    'imagen-3.0-generate-001': 'imagen-4.0-generate-001',
    'imagen-3.0-fast-generate-001': 'imagen-4.0-fast-generate-001',
  };

  if (deprecatedMap[lower]) {
    return deprecatedMap[lower];
  }

  // Future-proof pass-through rule:
  // If model matches standard gemini or imagen regex, preserve exactly as requested
  if (/^gemini-[a-z0-9.-]+$/i.test(trimmed) || /^imagen-[a-z0-9.-]+$/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
};

/**
 * Normalizes raw Firestore document items into deduplicated AIModelOption array
 * Prevents React Duplicate Key Warnings by enforcing uniqueness on `key`.
 */
const processModelDocs = (docs: any[]): CentralModelsResult => {
  const modelMap = new Map<string, AIModelOption>();

  docs.forEach((doc) => {
    const data = typeof doc.data === 'function' ? doc.data() : doc;
    if (data.isActive === false) return;

    const modelId = data.modelId || doc.id || data.key;
    if (!modelId) return;

    const name = data.name || modelId;
    const category = (data.category || '').toLowerCase();
    const order = typeof data.order === 'number' ? data.order : 999;
    
    const isDefaultLevel1 = data.isDefaultLevel1 === true || data.defaultLevel === 1 || data.defaultForLevel === 'level_1';
    const isDefaultLevel2 = data.isDefaultLevel2 === true || data.defaultLevel === 2 || data.defaultForLevel === 'level_2';

    // Deduplication check: Keep higher order or update
    if (!modelMap.has(modelId)) {
      modelMap.set(modelId, {
        key: modelId,
        name,
        category,
        order,
        isDefaultLevel1,
        isDefaultLevel2,
      });
    }
  });

  const rawModels = Array.from(modelMap.values());

  // Separate by category
  const textModels = rawModels
    .filter(m => m.category === 'text_reasoning' || m.category === 'text' || m.category === 'reasoning')
    .sort((a, b) => a.order - b.order);

  const imageModels = rawModels
    .filter(m => m.category === 'image_gen' || m.category === 'image' || m.category === 'image_generation')
    .sort((a, b) => a.order - b.order);

  // Merge with fallbacks if empty, while keeping uniqueness
  const mergeUnique = (primary: AIModelOption[], fallbacks: AIModelOption[]): AIModelOption[] => {
    const map = new Map<string, AIModelOption>();
    primary.forEach(m => map.set(m.key, m));
    fallbacks.forEach(m => {
      if (!map.has(m.key)) {
        map.set(m.key, m);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  };

  const finalTexts = textModels.length > 0 ? mergeUnique(textModels, FALLBACK_TEXT_MODELS) : FALLBACK_TEXT_MODELS;
  const finalImages = imageModels.length > 0 ? mergeUnique(imageModels, FALLBACK_IMAGE_MODELS) : FALLBACK_IMAGE_MODELS;

  // Level 1 Defaults
  const defaultTextObj = finalTexts.find(m => m.isDefaultLevel1) || finalTexts[0];
  const defaultTextModel = defaultTextObj ? defaultTextObj.key : 'gemini-3.6-flash';

  const defaultImageObj = finalImages.find(m => m.isDefaultLevel1) || finalImages[0];
  const defaultImageModel = defaultImageObj ? defaultImageObj.key : 'gemini-3-pro-image';

  return {
    textReasoningModels: finalTexts,
    imageModels: finalImages,
    defaultTextModel,
    defaultImageModel,
    isLiveSynced: true
  };
};

// In-memory cache for fast synchronous lookups
let cachedModels: CentralModelsResult = {
  textReasoningModels: FALLBACK_TEXT_MODELS,
  imageModels: FALLBACK_IMAGE_MODELS,
  defaultTextModel: 'gemini-3.6-flash',
  defaultImageModel: 'gemini-3-pro-image',
  isLiveSynced: false
};

export const getCachedCentralModels = (): CentralModelsResult => cachedModels;

/**
 * 2. Real-time Subscription to Centralized AI Models Registry via Firestore onSnapshot
 * All dropdowns and menus will update in real-time when new models are published to Firestore!
 */
export const subscribeToCentralizedModels = (
  callback: (models: CentralModelsResult) => void
): Unsubscribe => {
  try {
    const db = getReadonlyFirestore();
    const colRef = collection(db, "ai_models");

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const result = processModelDocs(snapshot.docs);
      cachedModels = result;
      callback(result);
    }, (error) => {
      console.warn("Firestore onSnapshot error for ai_models, using cached/fallback:", error);
      callback(cachedModels);
    });

    return unsubscribe;
  } catch (error) {
    console.warn("Failed to set up Firestore onSnapshot listener:", error);
    callback(cachedModels);
    return () => {};
  }
};

/**
 * One-shot fetch fallback
 */
export const fetchCentralizedModels = async (): Promise<CentralModelsResult> => {
  try {
    const db = getReadonlyFirestore();
    const querySnapshot = await getDocs(collection(db, "ai_models"));
    const result = processModelDocs(querySnapshot.docs);
    cachedModels = result;
    return result;
  } catch (error) {
    console.warn("Failed to fetch central models from Firestore, utilizing fallbacks:", error);
    return cachedModels;
  }
};

/**
 * 3. Smart Cascade Fallback Generator (Requirement 3)
 * 
 * Order of attempts:
 * 1) Requested target model (future-proof preserved)
 * 2) Same family models in descending version order (utilizing Central Registry first)
 *    e.g. gemini-3.8-flash > gemini-3.7-flash > gemini-3.6-flash > gemini-3.5-flash > gemini-3-flash-preview > gemini-flash-latest
 *    or gemini-3.5-flash-lite > gemini-3.1-flash-lite > gemini-flash-lite-latest
 * 3) Workhorse stable model (gemini-3.6-flash or Default Level 1)
 * 4) High-speed model (gemini-3.8-flash)
 * 5) Economy / widest token quota model (gemini-3.5-flash-lite or Lite family)
 * Deduplicated with `.filter((m, idx, arr) => arr.indexOf(m) === idx)`
 */
export const buildSmartFallbackCascade = (
  targetModel: string,
  taskType: 'text' | 'image' = 'text',
  customRegistry?: AIModelOption[]
): string[] => {
  const resolvedTarget = resolveModelName(targetModel);

  if (taskType === 'image') {
    const registeredImageKeys = (customRegistry || cachedModels.imageModels).map(m => m.key);
    const standardImageCascade = [
      resolvedTarget,
      ...registeredImageKeys,
      'gemini-3-pro-image',
      'gemini-3.1-flash-image',
      'gemini-2.5-flash-image',
      'imagen-4.0-generate-001',
      'gemini-flash-image-latest'
    ];
    return standardImageCascade.filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
  }

  // Text Reasoning Models Cascade
  const allKnownTextKeys = (customRegistry || cachedModels.textReasoningModels).map(m => m.key);
  const targetLower = resolvedTarget.toLowerCase();

  // Helper to extract numeric version for sorting
  const extractVersion = (key: string): number => {
    const match = key.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Identify family: 'lite', 'flash', 'pro', or generic
  let family = 'flash';
  if (targetLower.includes('lite')) {
    family = 'lite';
  } else if (targetLower.includes('pro')) {
    family = 'pro';
  }

  // Get same-family models from registry, sorted by version descending
  const sameFamilyFromRegistry = allKnownTextKeys
    .filter(k => {
      const kl = k.toLowerCase();
      if (family === 'lite') return kl.includes('lite');
      if (family === 'pro') return kl.includes('pro') && !kl.includes('image');
      return kl.includes('flash') && !kl.includes('lite') && !kl.includes('image');
    })
    .sort((a, b) => extractVersion(b) - extractVersion(a));

  // Fallback lists
  const defaultWorkhorse = cachedModels.defaultTextModel || 'gemini-3.6-flash';
  const highSpeed = 'gemini-3.8-flash';
  const economyLite = 'gemini-3.5-flash-lite';
  const latestStable = 'gemini-flash-latest';

  const modelsToTry: string[] = [
    resolvedTarget,
    ...sameFamilyFromRegistry,
    defaultWorkhorse,
    highSpeed,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    economyLite,
    'gemini-3.1-flash-lite',
    latestStable
  ];

  // Return strictly deduplicated list
  return modelsToTry.filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
};

/**
 * 6. Dynamic Short Model Display Formatter (Requirement 6)
 * Uses Regular Expressions to extract decimal version (\d+\.\d+) and keywords (Flash, Pro, Lite, Ultra)
 * Displays 2-3 lines automatically without hardcoded version digits, perfectly future-proof.
 */
export const getShortModelDisplay = (modelKeyOrName: string): {
  line1: string;
  line2?: string;
  line3?: string;
  fullShort: string;
} => {
  if (!modelKeyOrName) {
    return { line1: 'Gemini', line2: 'Flash', fullShort: 'Gemini Flash' };
  }

  const str = modelKeyOrName.trim();

  // Extract decimal version or single integer version (e.g. 4.5, 4.0, 3.8, 3.6, 3, 2.5)
  const verMatch = str.match(/(\d+(?:\.\d+)?)/);
  const version = verMatch ? verMatch[1] : '';

  // Extract key tier/family keywords
  const keywords: string[] = [];
  if (/ultra/i.test(str)) keywords.push('Ultra');
  if (/pro/i.test(str)) keywords.push('Pro');
  if (/flash/i.test(str)) keywords.push('Flash');
  if (/lite/i.test(str)) keywords.push('Lite');
  if (/image/i.test(str)) keywords.push('Image');
  if (/preview/i.test(str)) keywords.push('Prev');
  if (/latest/i.test(str)) keywords.push('Latest');

  const brand = /imagen/i.test(str) ? 'Imagen' : 'Gemini';

  if (version && keywords.length > 0) {
    const line1 = `${version} ${keywords[0]}`;
    const line2 = keywords.slice(1).join(' ');
    const fullShort = line2 ? `${line1} ${line2}` : line1;
    return {
      line1,
      line2: line2 || undefined,
      fullShort
    };
  }

  if (keywords.length > 0) {
    return {
      line1: brand,
      line2: keywords.join(' '),
      fullShort: `${brand} ${keywords.join(' ')}`
    };
  }

  // Fallback: clean up raw model name
  const clean = str.replace(/^(gemini|imagen)-/i, '').replace(/-/g, ' ');
  return {
    line1: clean.slice(0, 10),
    line2: clean.length > 10 ? clean.slice(10, 22) : undefined,
    fullShort: clean
  };
};
