import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, X, Check, AlertCircle, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { testGeminiApiKey, updateActiveApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentKey: string;
    onKeySaved: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
    isOpen,
    onClose,
    currentKey,
    onKeySaved
}) => {
    const [keyInput, setKeyInput] = useState(currentKey || '');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const handleTest = async () => {
        if (!keyInput.trim()) {
            setTestResult({ valid: false, message: 'Please enter an API key to test.' });
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await testGeminiApiKey(keyInput.trim());
            setTestResult(res);
        } catch (err: any) {
            setTestResult({ valid: false, message: err.message || 'Key test failed' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        const trimmed = keyInput.trim();
        if (trimmed && trimmed !== 'no API key') {
            localStorage.setItem('user_api_key', trimmed);
            updateActiveApiKey(trimmed);
            onKeySaved(trimmed);
        } else {
            localStorage.removeItem('user_api_key');
            updateActiveApiKey('');
            onKeySaved('');
        }
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative z-10 w-full max-w-lg p-6 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-left"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Gemini API Key Settings</h3>
                                <p className="text-xs text-gray-400">Secure Client Storage & Real-time Verification</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                                Your Personal Gemini API Key
                            </label>
                            <input
                                type="text"
                                value={keyInput}
                                onChange={(e) => {
                                    setKeyInput(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder="AIzaSy..."
                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                                Stored locally in your browser session. Never exposed to unauthorized third parties.
                            </p>
                        </div>

                        {/* Test Button & Result */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={isTesting || !keyInput.trim()}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-xs font-semibold rounded-lg border border-gray-700 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                                <span>{isTesting ? 'Testing...' : 'Test Key with Gemini API'}</span>
                            </button>

                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 ml-auto underline"
                            >
                                <span>Get API Key</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        {testResult && (
                            <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                                testResult.valid 
                                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                            }`}>
                                {testResult.valid ? (
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <div className="font-semibold">{testResult.valid ? 'Verified' : 'Test Failed'}</div>
                                    <div className="text-[11px] opacity-90">{testResult.message}</div>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                Save & Apply Key
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ApiKeyModal;
