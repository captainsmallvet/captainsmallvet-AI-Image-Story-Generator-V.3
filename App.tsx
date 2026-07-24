import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
    generateFromText, 
    generateFromImageAndText, 
    describeImage, 
    suggestCaption, 
    enhancePrompt, 
    generateConcept, 
    expandImage
} from './services/geminiService';
import { ASPECT_RATIOS, AspectRatio, ImageStyleKey, ImageModelKey, ReasoningModelKey } from './constants';
import { fetchCentralizedModels, AIModelOption, FALLBACK_IMAGE_MODELS, FALLBACK_TEXT_MODELS } from './services/centralModelService';
import Spinner from './components/Spinner';
import ReferenceImages from './components/ReferenceImages';
import { blobToBase64 } from './utils/imageUtils';
import PromptActions from './components/PromptActions';
import StoryWriter from './components/StoryWriter';
import { DetailedErrorPopup } from './components/DetailedErrorPopup';
import { AlertTriangle } from 'lucide-react';
import { useApiKey } from './hooks/useApiKey';
import ApiKeyHeader from './components/ApiKeyHeader';
import GeneratedImagesDisplay from './components/GeneratedImagesDisplay';

declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
}

const App: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [style, setStyle] = useState<ImageStyleKey>('photorealistic');
    const [imageModelOptions, setImageModelOptions] = useState<AIModelOption[]>(FALLBACK_IMAGE_MODELS);
    const [reasoningModelOptions, setReasoningModelOptions] = useState<AIModelOption[]>(FALLBACK_TEXT_MODELS);

    const [imageModel, setImageModel] = useState<ImageModelKey>('gemini-3-pro-image');
    const [reasoningModel, setReasoningModel] = useState<ReasoningModelKey>('gemini-3.6-flash');
    const [maxCaptionLength, setMaxCaptionLength] = useState<number>(60);

    const [images, setImages] = useState<string[]>([]);
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isErrorPopupOpen, setIsErrorPopupOpen] = useState<boolean>(false);

    const handleSetError = useCallback((msg: string) => {
        setError(msg);
    }, []);

    const {
        apiKeyInput,
        setApiKeyInput,
        statusMessage,
        keyCopied,
        handleSendKey,
        handleCopyKey,
        handleClearKey
    } = useApiKey(handleSetError);

    // Load Centralized Models from Firestore on every page refresh (Level 1 Importance)
    useEffect(() => {
        let isMounted = true;
        fetchCentralizedModels().then((result) => {
            if (!isMounted) return;
            setImageModelOptions(result.imageModels);
            setReasoningModelOptions(result.textReasoningModels);
            setImageModel(result.defaultImageModel);
            setReasoningModel(result.defaultTextModel);
        }).catch(err => {
            console.warn("Using fallback model lists:", err);
        });
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (error) {
            setIsErrorPopupOpen(true);
        }
    }, [error]);

    const [loadingCount, setLoadingCount] = useState<number>(0);
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const [promptActionLoading, setPromptActionLoading] = useState<string | null>(null);
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    const handleGenerate = useCallback(async (count: 1 | 4) => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }

        const hasKey = localStorage.getItem('user_api_key') || (process.env.API_KEY && process.env.API_KEY !== 'PLACEHOLDER_API_KEY');
        if (!hasKey && imageModel === 'gemini-3-pro-image-preview') {
            try {
                const nativeKey = await (window as any).aistudio.hasSelectedApiKey();
                if (!nativeKey) await (window as any).aistudio.openSelectKey();
            } catch (err) {
                setError("API Key is required. Please set it in the field above.");
                return;
            }
        }

        setLoading(true);
        setError(null);
        setImages([]);
        
        const isGeminiModel = imageModel === 'gemini-2.5-flash-image' || imageModel === 'gemini-3-pro-image-preview';
        let effectiveCount = (referenceImages.length > 0 || isGeminiModel) ? 1 : count;
        setLoadingCount(effectiveCount);

        try {
            let generatedImages: string[];
            if (referenceImages.length > 0) {
                 generatedImages = await generateFromImageAndText(prompt, referenceImages);
            } else {
                 generatedImages = await generateFromText(prompt, effectiveCount as 1 | 4, aspectRatio, style, imageModel);
            }
            setImages(generatedImages);
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes("Requested entity was not found") || err.message.includes("API_KEY_INVALID")) {
                     try {
                        setError("Invalid API Key. Please update the key in the field above.");
                        const controls = document.body;
                        controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch (e) {
                        setError("API Error: " + err.message);
                    }
                } else {
                    setError(err.message);
                }
            } else {
                setError("An unknown error occurred.");
            }
        } finally {
            setLoading(false);
            setLoadingCount(0);
        }
    }, [prompt, aspectRatio, style, imageModel, referenceImages]);

    const handleSetReference = useCallback((imageSrc: string) => {
        if (referenceImages.length < 4) {
            setReferenceImages(prev => [...prev, imageSrc]);
        } else {
            setError("You can only have a maximum of 4 reference images.");
        }
    }, [referenceImages.length]);
    
    const handleRemoveReference = useCallback((indexToRemove: number) => {
        setReferenceImages(prev => prev.filter((_, index) => index !== indexToRemove));
    }, []);

    const handleUploadReference = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError("Please upload a valid image file.");
            return;
        }
        try {
            const base64 = await blobToBase64(file);
            handleSetReference(base64 as string);
        } catch (err) {
            setError("Failed to read the image file.");
        }
    }, [handleSetReference]);

    const handleInsertRefTag = useCallback((tag: string) => {
        const textarea = promptTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newText = `${text.substring(0, start)} ${tag} ${text.substring(end)}`;
            setPrompt(newText);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + tag.length + 2;
        }
    }, []);

    const handleDescribe = useCallback(async (imageSrc: string, index: number) => {
        setProcessingAction(`describe-${index}`);
        setError(null);
        try {
            const description = await describeImage(imageSrc, reasoningModel);
            setPrompt(description);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessingAction(null);
        }
    }, [reasoningModel]);
    
    const handleCaption = useCallback(async (imageSrc: string, index: number) => {
        setProcessingAction(`caption-${index}`);
        setError(null);
        try {
            const caption = await suggestCaption(imageSrc, reasoningModel, maxCaptionLength);
            setReferenceImages([imageSrc]);
            const isThai = /[ก-ฮ]/.test(caption);
            const textType = isThai ? "Thai text" : "text";
            setPrompt(`Recreate the image in [ref-1], but add the following ${textType} as a caption: "${caption}". The ${textType} should be elegantly placed in a suitable position, using a beautiful font with a color that is easily readable against the background. Do not obscure important details like faces or key subjects. The ${textType} MUST be clear and readable, using the exact characters provided without translation.`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessingAction(null);
        }
    }, [reasoningModel, maxCaptionLength]);
    
    const handleRemoveText = useCallback(async (imageSrc: string, index: number) => {
        setProcessingAction(`remove-text-${index}`);
        setError(null);
        const newPrompt = `Analyze the image provided in [ref-1] and remove all text, words, characters and logos. Reconstruct the areas where the text was removed to look natural and seamless with the rest of the image.`;
        const newReferenceImages = [imageSrc];
        setPrompt(newPrompt);
        setReferenceImages(newReferenceImages);
        setLoading(true);
        setImages([]);
        setLoadingCount(1);
        try {
            const generatedImages = await generateFromImageAndText(newPrompt, newReferenceImages);
            setImages(generatedImages);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
            setLoadingCount(0);
            setProcessingAction(null);
        }
    }, []);

    const handleExpandImage = useCallback(async (imageSrc: string, index: number, targetAspectRatio: AspectRatio) => {
        setProcessingAction(`expand-${index}`);
        setLoading(true);
        setError(null);
        setImages([]);
        setLoadingCount(1);
        setAspectRatio(targetAspectRatio);
        try {
            const expandedImages = await expandImage(imageSrc, targetAspectRatio);
            setImages(expandedImages);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
            setLoadingCount(0);
            setProcessingAction(null);
            setAspectRatio('16:9');
        }
    }, []);

    const handleCopyPrompt = () => {
        if (!prompt.trim()) return;
        navigator.clipboard.writeText(prompt);
    };

    const handleClearPrompt = () => {
        setPrompt('');
    };

    const handleDescribeRef1 = useCallback(async () => {
        if (referenceImages.length === 0) {
            setError("No reference image available to describe.");
            return;
        }
        setPromptActionLoading('describe-ref-1');
        setError(null);
        try {
            const description = await describeImage(referenceImages[0], reasoningModel);
            setPrompt(description);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPromptActionLoading(null);
        }
    }, [referenceImages, reasoningModel]);

    const handleCaptionRef1 = useCallback(async () => {
        if (referenceImages.length === 0) {
            setError("No reference image available to caption.");
            return;
        }
        setPromptActionLoading('caption-ref-1');
        setError(null);
        try {
            const caption = await suggestCaption(referenceImages[0], reasoningModel, maxCaptionLength);
            setReferenceImages([referenceImages[0]]);
            const isThai = /[ก-ฮ]/.test(caption);
            const textType = isThai ? "Thai text" : "text";
            setPrompt(`Recreate the image in [ref-1], but add the following ${textType} as a caption: "${caption}". The ${textType} should be elegantly placed in a suitable position, using a beautiful font with a color that is easily readable against the background. Do not obscure important details like faces or key subjects. The ${textType} MUST be clear and readable, using the exact characters provided without translation.`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPromptActionLoading(null);
        }
    }, [referenceImages, reasoningModel, maxCaptionLength]);

    const handleRemoveTextRef1 = useCallback(async () => {
        if (referenceImages.length === 0) {
            setError("No reference image available to process.");
            return;
        }
        setPromptActionLoading('remove-text-ref-1');
        setError(null);
        const newPrompt = `Analyze the image provided in [ref-1] and remove all text, words, characters and logos. Reconstruct the areas where the text was removed to look natural and seamless with the rest of the image.`;
        const newReferenceImages = [referenceImages[0]];
        setPrompt(newPrompt);
        setReferenceImages(newReferenceImages);
        setLoading(true);
        setImages([]);
        setLoadingCount(1);
        try {
            const generatedImages = await generateFromImageAndText(newPrompt, newReferenceImages);
            setImages(generatedImages);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
            setLoadingCount(0);
            setPromptActionLoading(null);
        }
    }, [referenceImages]);

    const handleExpandRef1 = useCallback(async (targetAspectRatio: AspectRatio) => {
        if (referenceImages.length === 0) {
            setError("No reference image available to expand.");
            return;
        }
        setPromptActionLoading('expand-ref-1');
        setLoading(true);
        setError(null);
        setImages([]);
        setLoadingCount(1);
        setAspectRatio(targetAspectRatio);
        try {
            const expandedImages = await expandImage(referenceImages[0], targetAspectRatio);
            setImages(expandedImages);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
            setLoadingCount(0);
            setPromptActionLoading(null);
            setAspectRatio('16:9');
        }
    }, [referenceImages]);

    const handleEnhancePrompt = useCallback(async () => {
        if (!prompt.trim()) {
            setError("Prompt is empty, nothing to enhance.");
            return;
        }
        setPromptActionLoading('enhance');
        setError(null);
        try {
            const enhanced = await enhancePrompt(prompt, reasoningModel);
            setPrompt(enhanced);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPromptActionLoading(null);
        }
    }, [prompt, reasoningModel]);

    const handleConcept = useCallback(async () => {
        if (!prompt.trim()) {
            setError("Prompt is empty, cannot generate concept.");
            return;
        }
        setPromptActionLoading('concept');
        setError(null);
        try {
            const concept = await generateConcept(prompt, reasoningModel);
            setPrompt(concept);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPromptActionLoading(null);
        }
    }, [prompt, reasoningModel]);

    const handlePostStoryToPrompt = useCallback((storyText: string) => {
        setPrompt(storyText);
        const controlsElement = document.getElementById('controls');
        if (controlsElement) {
            controlsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const isGeminiImageModel = !imageModel.includes('imagen');

    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <ApiKeyHeader
                apiKeyInput={apiKeyInput}
                setApiKeyInput={setApiKeyInput}
                statusMessage={statusMessage}
                keyCopied={keyCopied}
                onSendKey={handleSendKey}
                onCopyKey={handleCopyKey}
                onClearKey={handleClearKey}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 pb-2">
                        AI Image & Story Generator
                    </h1>
                    <p className="mt-3 text-lg text-gray-300">
                        stunning high-quality visuals & amazing stories by Thunyaluk AI
                    </p>
                </header>

                <GeneratedImagesDisplay
                    loading={loading}
                    loadingCount={loadingCount}
                    images={images}
                    aspectRatio={aspectRatio}
                    processingAction={processingAction}
                    onSetReference={handleSetReference}
                    onDescribe={handleDescribe}
                    onCaption={handleCaption}
                    onRemoveText={handleRemoveText}
                    onExpand={handleExpandImage}
                />

                <section id="controls" className="bg-gray-800/50 backdrop-blur-md rounded-lg p-4 sm:p-6 shadow-xl max-w-4xl mx-auto border border-gray-700">
                    {error && (
                        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm flex items-center justify-between">
                             <div className="flex items-center">
                                 <svg className="w-5 h-5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
                                 <div><span className="font-bold">Error:</span> {error}</div>
                             </div>
                             <button 
                                 type="button"
                                 onClick={() => setIsErrorPopupOpen(true)}
                                 className="ml-3 shrink-0 px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 text-xs font-semibold rounded border border-red-500/40 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                             >
                                 <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                 <span>รายละเอียดเชิงลึก</span>
                             </button>
                        </div>
                    )}
                    
                    <ReferenceImages images={referenceImages} onRemove={handleRemoveReference} onUpload={handleUploadReference} onInsertTag={handleInsertRefTag} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                {ASPECT_RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                Image Model (Art Style)
                            </label>
                            <select value={imageModel} onChange={(e) => setImageModel(e.target.value as ImageModelKey)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-indigo-400 outline-none transition-all">
                                {imageModelOptions.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <PromptActions
                        prompt={prompt}
                        hasReferenceImage={referenceImages.length > 0}
                        onCopy={handleCopyPrompt}
                        onClear={handleClearPrompt}
                        onDescribe={handleDescribeRef1}
                        onCaption={handleCaptionRef1}
                        onRemoveText={handleRemoveTextRef1}
                        onExpand={handleExpandRef1}
                        onEnhance={handleEnhancePrompt}
                        onConcept={handleConcept}
                        loadingAction={promptActionLoading}
                    />

                    <textarea
                        ref={promptTextareaRef}
                        rows={5}
                        className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-3 mb-4 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Describe your vision..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        <button
                            onClick={() => handleGenerate(1)}
                            disabled={loading || !prompt.trim()}
                            className={`bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-md transition-all shadow-md active:scale-95 cursor-pointer ${(isGeminiImageModel || referenceImages.length > 0) ? 'sm:col-span-2' : ''}`}
                        >
                            {loading && loadingCount === 1 ? <Spinner /> : `Generate`}
                        </button>
                        {!(isGeminiImageModel || referenceImages.length > 0) && (
                             <button
                                onClick={() => handleGenerate(4)}
                                disabled={loading || !prompt.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-md transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                {loading && loadingCount === 4 ? <Spinner /> : 'Generate 4 Images'}
                            </button>
                        )}
                    </div>
                    <StoryWriter 
                        onPostToPrompt={handlePostStoryToPrompt} 
                        selectedStyle={style} 
                        onStyleChange={setStyle}
                        selectedReasoningModel={reasoningModel} 
                        onReasoningModelChange={setReasoningModel}
                        reasoningModelOptions={reasoningModelOptions}
                        maxCaptionLength={maxCaptionLength}
                        onMaxCaptionLengthChange={setMaxCaptionLength}
                    />
                </section>
            </div>

            <DetailedErrorPopup 
                isOpen={isErrorPopupOpen}
                onClose={() => setIsErrorPopupOpen(false)}
                errorMessage={error || ''}
                activeModel={imageModel}
                context="Image Generator"
            />
        </div>
    );
};

export default App;
