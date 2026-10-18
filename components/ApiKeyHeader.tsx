import React from 'react';
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react';

interface ApiKeyHeaderProps {
    apiKeyInput: string;
    setApiKeyInput: (val: string) => void;
    statusMessage: string;
    keyCopied: boolean;
    onSendKey: () => void;
    onCopyKey: () => void;
    onClearKey: () => void;
    onOpenLogs?: () => void;
    onOpenKeyModal?: () => void;
    isLiveSynced?: boolean;
}

export const ApiKeyHeader: React.FC<ApiKeyHeaderProps> = ({
    apiKeyInput,
    setApiKeyInput,
    statusMessage,
    keyCopied,
    onSendKey,
    onCopyKey,
    onClearKey,
    onOpenLogs,
    onOpenKeyModal,
    isLiveSynced = false
}) => {
    return (
        <div className="w-full bg-gray-800 border-b border-gray-700 p-3 sm:p-4 sticky top-0 z-50 shadow-2xl">
            <div className="max-w-7xl mx-auto flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <label className="text-blue-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                            </svg>
                            API key :
                        </label>
                        {statusMessage && <span className="text-xs font-semibold text-green-400 animate-pulse">{statusMessage}</span>}

                        {isLiveSynced && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-700/40 text-[10px] font-mono">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
                                Central Models Live Sync
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {onOpenLogs && (
                            <button
                                type="button"
                                onClick={onOpenLogs}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-bold rounded shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                title="Open AI Execution & Resilience Logs"
                            >
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                <span>AI Logs</span>
                            </button>
                        )}

                        {onOpenKeyModal && (
                            <button
                                type="button"
                                onClick={onOpenKeyModal}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-bold rounded shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                title="Test & Securely Manage API Key"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Test Key</span>
                            </button>
                        )}

                        <button 
                            onClick={onSendKey} 
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            Send
                        </button>
                        <button 
                            onClick={onCopyKey} 
                            className={`px-4 py-1.5 rounded shadow-md transition-all active:scale-95 flex items-center gap-1 text-xs font-bold cursor-pointer ${keyCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                        >
                            {keyCopied ? (
                                <>
                                    <svg className="w-3.5 h-3.5 text-white animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"></path></svg>
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <span>Copy</span>
                            )}
                        </button>
                        <button 
                            onClick={onClearKey} 
                            className="px-4 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-200 text-xs font-bold rounded shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                <textarea
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-xs sm:text-sm text-gray-300 font-mono h-14 resize-none outline-none focus:ring-1 focus:ring-blue-500 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-700"
                    placeholder="Paste your Gemini API key here..."
                    spellCheck={false}
                />
            </div>
        </div>
    );
};

export default ApiKeyHeader;
