import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    X, 
    Activity, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    Cpu, 
    ShieldCheck, 
    Copy, 
    Trash2, 
    Check, 
    Shuffle,
    Server,
    Laptop
} from 'lucide-react';
import { aiLogService, AILogEntry } from '../services/aiLogService';

interface AILogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AILogModal: React.FC<AILogModalProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<AILogEntry[]>([]);
    const [copied, setCopied] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AILogEntry | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = aiLogService.subscribe((updatedLogs) => {
            setLogs(updatedLogs);
            if (updatedLogs.length > 0 && !selectedLog) {
                setSelectedLog(updatedLogs[0]);
            }
        });
        return unsubscribe;
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCopyAll = () => {
        const text = JSON.stringify(logs, null, 2);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClear = () => {
        aiLogService.clearLogs();
        setSelectedLog(null);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
                />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-900 border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header bar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    AI Execution & Resilience Log
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                                        Dual-Layer Engine
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-400">
                                    Transparency Tracker: Requested Model vs Responding Model & Cascade Fallbacks
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyAll}
                                disabled={logs.length === 0}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                                title="Copy all logs as JSON"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copied ? 'Copied' : 'Export JSON'}</span>
                            </button>
                            <button
                                onClick={handleClear}
                                disabled={logs.length === 0}
                                className="p-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-red-950/60 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-600/40 transition-all cursor-pointer disabled:opacity-40"
                                title="Clear log history"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content area: split list & detail */}
                    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
                        {/* List column */}
                        <div className="md:col-span-5 border-r border-gray-800 overflow-y-auto max-h-[55vh] md:max-h-[65vh] p-2 space-y-1.5 scrollbar-thin">
                            {logs.length === 0 ? (
                                <div className="py-16 text-center text-gray-500 text-sm">
                                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    No AI operations recorded yet in this session.
                                </div>
                            ) : (
                                logs.map((log) => {
                                    const isSelected = selectedLog?.id === log.id;
                                    const isFallback = log.fallbackOccurred;
                                    const isSuccess = log.status !== 'error';

                                    return (
                                        <div
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                                                isSelected 
                                                    ? 'bg-blue-950/40 border-blue-500/60 shadow-md' 
                                                    : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800/80 hover:border-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1 mb-1.5">
                                                <span className="font-mono text-xs font-semibold text-gray-200 truncate">
                                                    {log.action}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs mb-1.5">
                                                {isSuccess ? (
                                                    isFallback ? (
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                                                            <Shuffle className="w-3 h-3" />
                                                            Cascade Succeeded
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Direct Target
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Failed
                                                    </span>
                                                )}

                                                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {log.latencyMs}ms
                                                </span>
                                            </div>

                                            <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                                                <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
                                                <span className="truncate">
                                                    {log.actualModel !== 'none' ? log.actualModel : log.requestedModel}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Detail column */}
                        <div className="md:col-span-7 p-4 sm:p-5 overflow-y-auto max-h-[55vh] md:max-h-[65vh] bg-gray-950/40">
                            {selectedLog ? (
                                <div className="space-y-4 text-left">
                                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                                        <div>
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                <span>{selectedLog.action}</span>
                                            </h4>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                ID: <span className="font-mono text-gray-500">{selectedLog.id}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {selectedLog.environment === 'ai-studio-proxy' ? (
                                                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-700/40 rounded-full font-mono">
                                                    <Server className="w-3 h-3" />
                                                    Server Proxy
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 rounded-full font-mono">
                                                    <Laptop className="w-3 h-3" />
                                                    Direct Client
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Requested vs Actual Model Comparison */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                                Requested Target
                                            </div>
                                            <div className="text-xs font-mono font-semibold text-blue-300 break-all">
                                                {selectedLog.requestedModel}
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                                                Actual Responding
                                                {selectedLog.fallbackOccurred && (
                                                    <span className="text-amber-400 font-bold">(Cascaded)</span>
                                                )}
                                            </div>
                                            <div className={`text-xs font-mono font-semibold break-all ${
                                                selectedLog.fallbackOccurred ? 'text-amber-300' : 'text-emerald-300'
                                            }`}>
                                                {selectedLog.actualModel}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics pill row */}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <div className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                                            <span className="text-gray-400">Latency:</span>
                                            <span className="font-mono font-bold text-white">{selectedLog.latencyMs} ms</span>
                                        </div>

                                        <div className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                                            <span className="text-gray-400">Key Source:</span>
                                            <span className="font-mono text-indigo-300">{selectedLog.keySource}</span>
                                        </div>
                                    </div>

                                    {/* Cascade Path Timeline */}
                                    {selectedLog.fallbackPath && selectedLog.fallbackPath.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
                                            <div className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                                                <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                                                Cascade Fallback Trajectory ({selectedLog.fallbackPath.length} models attempted)
                                            </div>
                                            <div className="space-y-1.5 font-mono text-xs">
                                                {selectedLog.fallbackPath.map((stepModel, index) => {
                                                    const isResponding = stepModel === selectedLog.actualModel;
                                                    return (
                                                        <div 
                                                            key={index}
                                                            className={`flex items-center gap-2 px-2.5 py-1 rounded ${
                                                                isResponding 
                                                                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200' 
                                                                    : 'text-gray-400 bg-gray-950/50'
                                                            }`}
                                                        >
                                                            <span className="text-[10px] text-gray-500 w-4">#{index + 1}</span>
                                                            <span className="truncate">{stepModel}</span>
                                                            {isResponding && (
                                                                <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded bg-emerald-700/50 text-white font-sans font-bold">
                                                                    Answered
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Details if any */}
                                    {selectedLog.errorDetails && (
                                        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                                            <div className="font-semibold mb-1 flex items-center gap-1.5 text-rose-400">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Diagnostic Details:
                                            </div>
                                            <pre className="font-mono text-[11px] whitespace-pre-wrap break-all opacity-90">
                                                {selectedLog.errorDetails}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-20 text-center text-gray-500 text-sm">
                                    Select an operation from the left to view detailed cascade telemetry.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between text-xs text-gray-400">
                        <span>Dual-Layer Resilient Engine: Smart Cascade Active</span>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AILogModal;
