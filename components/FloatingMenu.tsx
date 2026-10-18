import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Cpu, 
    Activity, 
    KeyRound, 
    Image as ImageIcon, 
    ChevronUp, 
    Sparkles, 
    Check, 
    Layers
} from 'lucide-react';
import { getShortModelDisplay, AIModelOption } from '../services/centralModelService';
import { aiLogService, AILogEntry } from '../services/aiLogService';

interface FloatingMenuProps {
    selectedReasoningModel: string;
    onReasoningModelChange: (model: string) => void;
    reasoningModelOptions: AIModelOption[];

    selectedImageModel: string;
    onImageModelChange: (model: string) => void;
    imageModelOptions: AIModelOption[];

    onOpenLogs: () => void;
    onOpenKeySettings: () => void;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
    selectedReasoningModel,
    onReasoningModelChange,
    reasoningModelOptions,
    selectedImageModel,
    onImageModelChange,
    imageModelOptions,
    onOpenLogs,
    onOpenKeySettings
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'brain' | 'image'>('brain');
    const [latestLog, setLatestLog] = useState<AILogEntry | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Dynamic short representation of active reasoning and image models
    const shortBrain = getShortModelDisplay(selectedReasoningModel);
    const shortImage = getShortModelDisplay(selectedImageModel);

    // Listen to AI Log Service for live status pulse
    useEffect(() => {
        const unsubscribe = aiLogService.subscribe((logs) => {
            if (logs.length > 0) {
                setLatestLog(logs[0]);
            }
        });
        return unsubscribe;
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Determine status badge color
    const getStatusIndicator = () => {
        if (!latestLog) return { bg: 'bg-emerald-500', pulse: 'bg-emerald-400', label: 'Engine Ready' };
        if (latestLog.status === 'error') {
            return { bg: 'bg-rose-500', pulse: 'bg-rose-400', label: 'Last Task Failed' };
        }
        if (latestLog.fallbackOccurred) {
            return { bg: 'bg-amber-500', pulse: 'bg-amber-400', label: 'Cascade Fallback Recovered' };
        }
        return { bg: 'bg-emerald-500', pulse: 'bg-emerald-400', label: 'Direct Response Succeeded' };
    };

    const status = getStatusIndicator();

    return (
        <aside 
            ref={menuRef} 
            aria-label="AI Model Quick Switcher and System Telemetry"
            className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 select-none"
        >
            {/* Expanded Flyout Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="w-80 sm:w-96 p-3 bg-gray-900/95 backdrop-blur-xl border border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden mb-1"
                    >
                        {/* Header Tabs */}
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setActiveTab('brain')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'brain'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                                >
                                    <Cpu className="w-3.5 h-3.5" />
                                    <span>Brain (Text)</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('image')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'image'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                                >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Image Gen</span>
                                </button>
                            </div>

                            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500">
                                Live Sync
                            </span>
                        </div>

                        {/* Model List with real-time selection */}
                        <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin pr-1 text-left">
                            {activeTab === 'brain' ? (
                                reasoningModelOptions.map((model) => {
                                    const isSelected = model.key === selectedReasoningModel;
                                    const short = getShortModelDisplay(model.name);
                                    return (
                                        <button
                                            key={model.key}
                                            onClick={() => {
                                                onReasoningModelChange(model.key);
                                            }}
                                            className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                                                isSelected
                                                    ? 'bg-blue-600/30 border border-blue-500/60 text-white'
                                                    : 'hover:bg-gray-800/80 text-gray-300 border border-transparent'
                                            }`}
                                        >
                                            <div className="truncate">
                                                <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                                    <span className="font-mono text-blue-400">{short.fullShort}</span>
                                                    {model.isDefaultLevel1 && (
                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-900/60 text-blue-300 font-sans">
                                                            Workhorse
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono truncate">
                                                    {model.key}
                                                </div>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                                        </button>
                                    );
                                })
                            ) : (
                                imageModelOptions.map((model) => {
                                    const isSelected = model.key === selectedImageModel;
                                    const short = getShortModelDisplay(model.name);
                                    return (
                                        <button
                                            key={model.key}
                                            onClick={() => {
                                                onImageModelChange(model.key);
                                            }}
                                            className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600/30 border border-indigo-500/60 text-white'
                                                    : 'hover:bg-gray-800/80 text-gray-300 border border-transparent'
                                            }`}
                                        >
                                            <div className="truncate">
                                                <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                                    <span className="font-mono text-indigo-400">{short.fullShort}</span>
                                                    {model.isDefaultLevel1 && (
                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-900/60 text-indigo-300 font-sans">
                                                            Primary
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono truncate">
                                                    {model.key}
                                                </div>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Bottom Action Triggers */}
                        <div className="pt-2.5 mt-2 border-t border-gray-800 flex items-center justify-between text-xs">
                            <button
                                onClick={() => {
                                    onOpenLogs();
                                    setIsOpen(false);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-all cursor-pointer"
                            >
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                <span>AI Logs & Telemetry</span>
                            </button>

                            <button
                                onClick={() => {
                                    onOpenKeySettings();
                                    setIsOpen(false);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-all cursor-pointer"
                            >
                                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                <span>API Key</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Floating Trigger Pill */}
            <div className="flex items-center gap-2">
                {/* AI Log Status Pulse Button */}
                <button
                    onClick={onOpenLogs}
                    title={`AI Status: ${status.label}. Click to view live Execution Logs.`}
                    className="p-2.5 rounded-2xl bg-gray-900/90 backdrop-blur-md border border-gray-700 hover:border-blue-500/50 shadow-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer group"
                >
                    <div className="relative flex items-center justify-center">
                        <span className={`animate-ping absolute inline-flex h-3 w-3 rounded-full ${status.pulse} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status.bg}`}></span>
                    </div>
                </button>

                {/* Floating Model Badge with Dynamic 2-3 Line Display */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-3 py-2 rounded-2xl bg-gray-900/90 hover:bg-gray-850 backdrop-blur-md border border-gray-700 hover:border-blue-500/60 shadow-xl transition-all active:scale-95 flex items-center gap-2.5 cursor-pointer group text-left"
                >
                    <div className="flex items-center justify-center p-1.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
                        <Sparkles className="w-4 h-4" />
                    </div>

                    {/* Dynamic 2-Line or 3-Line display from regex extractor */}
                    <div className="leading-tight flex flex-col justify-center">
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] font-extrabold font-mono text-blue-300">
                                {shortBrain.line1}
                            </span>
                            {shortBrain.line2 && (
                                <span className="text-[10px] font-mono text-gray-400">
                                    {shortBrain.line2}
                                </span>
                            )}
                        </div>
                        <div className="text-[9px] text-indigo-300/80 font-mono flex items-center gap-1">
                            <span>Img:</span>
                            <span>{shortImage.line1}</span>
                        </div>
                    </div>

                    <ChevronUp className={`w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </aside>
    );
};

export default FloatingMenu;
