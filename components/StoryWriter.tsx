
import React, { useState, useRef, useEffect } from 'react';
import { STORY_LANGUAGES, STORY_STYLES, IMAGE_STYLES, REASONING_MODELS, StoryLanguageKey, StoryStyleKey, ImageStyleKey, ReasoningModelKey } from '../constants';
import { generateNextSentence, generateStoryCaption, polishStory, translateStory, generateDesignFromStory, generateRandomDharma, generateRandomNews } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { DetailedErrorPopup } from './DetailedErrorPopup';
import { AlertTriangle } from 'lucide-react';
import { AIModelOption } from '../services/centralModelService';
import StoryFileControls from './StoryFileControls';

interface StoryWriterProps {
    onPostToPrompt: (storyText: string) => void;
    selectedStyle: ImageStyleKey;
    onStyleChange: (style: ImageStyleKey) => void;
    selectedReasoningModel: ReasoningModelKey;
    onReasoningModelChange: (model: ReasoningModelKey) => void;
    reasoningModelOptions?: AIModelOption[];
    maxCaptionLength: number;
    onMaxCaptionLengthChange: (length: number) => void;
}

const ActionButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    children: React.ReactNode;
    title: string;
    className?: string;
}> = ({ onClick, disabled, isLoading, children, title, className = '' }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        title={title}
        className={`flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-sm text-gray-300 hover:text-white rounded-md transition-all cursor-pointer ${className}`}
    >
        {isLoading ? <Spinner /> : children}
    </button>
);

const StoryWriter: React.FC<StoryWriterProps> = ({ 
    onPostToPrompt, 
    selectedStyle, 
    onStyleChange,
    selectedReasoningModel,
    onReasoningModelChange,
    reasoningModelOptions,
    maxCaptionLength,
    onMaxCaptionLengthChange
}) => {
    const [story, setStory] = useState('');
    const [fileName, setFileName] = useState('story.txt');
    const [language, setLanguage] = useState<StoryLanguageKey>('thai');
    const [style, setStyle] = useState<StoryStyleKey>('unspecified');
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isErrorPopupOpen, setIsErrorPopupOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (error) {
            setIsErrorPopupOpen(true);
        }
    }, [error]);

    const handleClear = () => setStory('');

    const handleRandomDharmaClick = async () => {
        setLoadingAction('random-dharma');
        setError(null);
        try {
            const dharmaText = await generateRandomDharma(selectedReasoningModel);
            setStory(dharmaText);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRandomNewsClick = async () => {
        setLoadingAction('random-news');
        setError(null);
        try {
            const newsText = await generateRandomNews(selectedReasoningModel);
            setStory(newsText);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(story);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePost = () => onPostToPrompt(story);
    
    const handleIdea = async () => {
        setLoadingAction('idea');
        setError(null);
        try {
            const nextSentence = await generateNextSentence(story, language, style, selectedReasoningModel);
            if (style === 'thai_poem') {
                setStory(prev => (prev.trim() ? prev.trim() + '\n' + nextSentence : nextSentence));
            } else {
                setStory(prev => (prev.trim() ? prev.trim() + ' ' + nextSentence : nextSentence));
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };
    
    const handleCustomCaption = async () => {
        if (!story.trim()) {
            setError("Story is empty. Cannot create a caption.");
            return;
        }
        setLoadingAction('caption');
        setError(null);
        try {
            const caption = await generateStoryCaption(story, selectedReasoningModel, 'English', maxCaptionLength);
            const fullPrompt = `Recreate the image in [ref-1], but add the following text as a caption: "${caption}". The text should be elegantly placed in a suitable position, using a beautiful font with a color that is easily readable against the background. Do not obscure important details like faces or key subjects. The text should be clear and readable on a mobile screen. Use the exact text provided without translation.`;
            onPostToPrompt(fullPrompt);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleThaiCaption = async () => {
        if (!story.trim()) {
            setError("Story is empty. Cannot create a caption.");
            return;
        }
        setLoadingAction('caption-thai');
        setError(null);
        try {
            const caption = await generateStoryCaption(story, selectedReasoningModel, 'Thai', maxCaptionLength);
            const fullPrompt = `Recreate the image in [ref-1], but add the following Thai text as a caption: "${caption}". The Thai text should be elegantly placed in a suitable position, using a beautiful font with a color that is easily readable against the background. Do not obscure important details like faces or key subjects. The Thai text MUST be rendered exactly as written in Thai characters, without any translation to English.`;
            onPostToPrompt(fullPrompt);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleNewThaiCaption = async () => {
        if (!story.trim()) {
            setError("Story is empty. Cannot create a caption.");
            return;
        }
        setLoadingAction('new-caption-thai');
        setError(null);
        try {
            const styleName = IMAGE_STYLES.find(s => s.key === selectedStyle)?.name || 'Photorealistic';
            
            const [caption, designPrompt] = await Promise.all([
                generateStoryCaption(story, selectedReasoningModel, 'Thai', maxCaptionLength),
                generateDesignFromStory(story, styleName, selectedReasoningModel)
            ]);
            
            const fullPrompt = `${designPrompt} Thai text in the image: "${caption}". The Thai text should be elegantly placed in a suitable position, using a beautiful font with a color that is easily readable against the background. Do not obscure important details like faces or key subjects. The Thai text MUST be rendered exactly as written in Thai characters, without any translation to English.`;
            onPostToPrompt(fullPrompt);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };
    
    const handlePolish = async () => {
        if (!story.trim()) {
            setError("Story is empty. Nothing to polish.");
            return;
        }
        setLoadingAction('polish');
        setError(null);
        try {
            const polishedStory = await polishStory(story, selectedReasoningModel);
            onPostToPrompt(polishedStory);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleTranslate = async (targetLanguage: 'Thai' | 'English') => {
        if (!story.trim()) {
            setError(`Story is empty. Nothing to translate to ${targetLanguage}.`);
            return;
        }
        const actionKey = `translate-${targetLanguage.toLowerCase()}`;
        setLoadingAction(actionKey);
        setError(null);
        try {
            const translatedStory = await translateStory(story, targetLanguage, selectedReasoningModel);
            onPostToPrompt(translatedStory);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="mt-8 border-t border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-center mb-4 text-gray-200 flex items-center justify-center gap-2">
                 <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                 Story Writer
            </h3>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm flex items-center justify-between">
                    <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-3 text-red-400 shrink-0" />
                        <div><span className="font-bold">Error:</span> {error}</div>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsErrorPopupOpen(true)}
                        className="ml-3 shrink-0 px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 text-xs font-semibold rounded border border-red-500/40 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                        <span>รายละเอียดเชิงลึก</span>
                    </button>
                </div>
            )}

            <StoryFileControls
                fileName={fileName}
                setFileName={setFileName}
                story={story}
                setStory={setStory}
                textareaRef={textareaRef}
                onError={setError}
            />

            <textarea
                ref={textareaRef}
                rows={10}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600 resize-y p-3 transition-all"
                placeholder="Write your story here..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
                disabled={!!loadingAction}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 mb-4">
                <div>
                    <label htmlFor="language" className="block text-xs font-medium text-gray-400 mb-1">ภาษา</label>
                    <select id="language" value={language} onChange={(e) => setLanguage(e.target.value as StoryLanguageKey)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                        {STORY_LANGUAGES.map(lang => <option key={lang.key} value={lang.key}>{lang.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="style" className="block text-xs font-medium text-gray-400 mb-1">สไตล์การเล่าเรื่อง</label>
                    <select id="style" value={style} onChange={(e) => setStyle(e.target.value as StoryStyleKey)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                        {STORY_STYLES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                    <label htmlFor="imageStyle" className="block text-xs font-medium text-gray-400 mb-1">Image Style</label>
                    <select id="imageStyle" value={selectedStyle} onChange={(e) => onStyleChange(e.target.value as ImageStyleKey)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                        {IMAGE_STYLES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="reasoningModel" className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9l-.707.707M12 18v1m4.243-4.243l.707.707M12 7a5 5 0 110 10 5 5 0 010-10z"></path></svg>
                        Text Reasoning Model (AI Brain)
                    </label>
                    <select id="reasoningModel" value={selectedReasoningModel} onChange={(e) => onReasoningModelChange(e.target.value as ReasoningModelKey)} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-400 outline-none text-sm">
                        {(reasoningModelOptions && reasoningModelOptions.length > 0 ? reasoningModelOptions : REASONING_MODELS)
                            .filter((m, idx, arr) => arr.findIndex(x => x.key === m.key) === idx)
                            .map(m => (
                                <option key={m.key} value={m.key}>{m.name}</option>
                            ))
                        }
                    </select>
                </div>
            </div>

            {/* Max Caption Length Setting */}
            <div className="mb-4 flex flex-col items-center">
                 <label htmlFor="maxCaptionLength" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                    Max Caption Length (Characters)
                 </label>
                 <input 
                    type="number"
                    id="maxCaptionLength"
                    value={maxCaptionLength}
                    onChange={(e) => onMaxCaptionLengthChange(parseInt(e.target.value) || 0)}
                    className="w-24 bg-gray-900 border border-gray-700 text-center text-blue-400 font-bold rounded-md py-1.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                 />
            </div>

            <div className="flex flex-wrap gap-2.5 justify-center">
                <ActionButton onClick={handleIdea} isLoading={loadingAction === 'idea'} title="Generate the next sentence" className="bg-green-600 hover:bg-green-700 text-white font-bold">Idea</ActionButton>
                <ActionButton onClick={handleCustomCaption} isLoading={loadingAction === 'caption'} disabled={!story} title="Create an English caption for your story">Custom Caption</ActionButton>
                <ActionButton onClick={handleThaiCaption} isLoading={loadingAction === 'caption-thai'} disabled={!story} title="Create a Thai caption for your story">Thai Caption</ActionButton>
                <ActionButton onClick={handleNewThaiCaption} isLoading={loadingAction === 'new-caption-thai'} disabled={!story} title="New image with Thai caption based on story" className="bg-indigo-600 hover:bg-indigo-700 text-white">New Thai Caption</ActionButton>
                <ActionButton onClick={handlePolish} isLoading={loadingAction === 'polish'} disabled={!story} title="Rewrite the story professionally">Polish</ActionButton>
                <ActionButton onClick={handlePost} disabled={!story} title="Post story to main prompt" className="bg-blue-600 hover:bg-blue-500">Post</ActionButton>
                <ActionButton onClick={() => handleTranslate('Thai')} isLoading={loadingAction === 'translate-thai'} disabled={!story} title="Translate story to Thai and post to prompt">Thai</ActionButton>
                <ActionButton onClick={() => handleTranslate('English')} isLoading={loadingAction === 'translate-english'} disabled={!story} title="Translate story to English and post to prompt">English</ActionButton>
                <ActionButton 
                    onClick={handleCopy} 
                    disabled={!story} 
                    title="Copy story to clipboard"
                    className={copied ? 'bg-green-600 hover:bg-green-700 text-white font-semibold' : ''}
                >
                    {copied ? (
                        <>
                            <svg className="w-4 h-4 text-white animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"></path></svg>
                            <span>Copied!</span>
                        </>
                    ) : (
                        <span>Copy</span>
                    )}
                </ActionButton>
                <ActionButton onClick={handleClear} disabled={!story} title="Clear story text">Clear</ActionButton>
                <ActionButton 
                    onClick={handleRandomDharmaClick} 
                    isLoading={loadingAction === 'random-dharma'} 
                    title="สุ่มเลือกหลักธรรมคำสอนหรือเรื่องราวจากพระไตรปิฎกด้วย AI" 
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                    <svg className="w-3.5 h-3.5 text-amber-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.02 12.02l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    <span>สุ่มธรรมะ</span>
                </ActionButton>
                <ActionButton 
                    onClick={handleRandomNewsClick} 
                    isLoading={loadingAction === 'random-news'} 
                    title="สุ่มข่าวสารสำคัญที่เป็นกระแสโลกหรือในไทยด้วย AI" 
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                    <svg className="w-3.5 h-3.5 text-sky-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2h-3m3 3l-3-3m3 3h-9m12 2H5m2 4h6" />
                    </svg>
                    <span>สุ่มข่าว</span>
                </ActionButton>
            </div>
            
            <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                    * ทิป: เลือกสมอง (Reasoning Model) เป็น <span className="text-blue-400">Flash</span> เพื่อประหยัดโควต้า หรือ <span className="text-indigo-400">Pro</span> เพื่อความลุ่มลึกในการต่อเนื้อเรื่อง
                </p>
            </div>

            <DetailedErrorPopup 
                isOpen={isErrorPopupOpen}
                onClose={() => setIsErrorPopupOpen(false)}
                errorMessage={error || ''}
                activeModel={selectedReasoningModel}
                context="Story Writer"
            />
        </div>
    );
};

export default StoryWriter;
