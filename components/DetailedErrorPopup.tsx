import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Check, X, ShieldAlert, Cpu, KeyRound } from 'lucide-react';

interface DetailedErrorPopupProps {
    isOpen: boolean;
    onClose: () => void;
    errorMessage: string;
    activeModel?: string;
    context?: string; // e.g. "image-generator", "story-writer"
}

export const DetailedErrorPopup: React.FC<DetailedErrorPopupProps> = ({
    isOpen,
    onClose,
    errorMessage,
    activeModel = 'N/A',
    context = 'General'
}) => {
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen || !errorMessage) return null;

    // Intelligent Thai analysis & actionable advice based on keywords in the error message
    const analyzeError = (err: string) => {
        const lower = err.toLowerCase();
        
        if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || lower.includes('key is required')) {
            return {
                title: 'กุญแจ API ไม่ถูกต้องหรือไม่ได้รับการตั้งค่า (Invalid/Missing API Key)',
                icon: <KeyRound className="w-5 h-5 text-amber-400" />,
                advice: 'กรุณาตรวจสอบว่าคุณใส่ API Key ของ Gemini ถูกต้องในกล่องข้อความด้านบนสุด และกดปุ่ม "Send" เพื่อบันทึก หรือตรวจสอบให้แน่ใจว่า API Key ยังไม่หมดอายุหรือถูกลบจาก Google AI Studio Dashboard',
                category: 'Authentication'
            };
        }
        if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('exhausted') || lower.includes('limit')) {
            return {
                title: 'โควต้าการใช้งานหมดชั่วคราว (Quota Exceeded / Rate Limit)',
                icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
                advice: 'คุณใช้โมเดลในจำนวนครั้งที่เกินกำหนดชั่วคราว กรุณาลองเปลี่ยนประเภท "Text Reasoning Model" หรือ "Image Model" เป็นโมเดลที่มีโควต้าเยอะขึ้น (เช่น ตระกูล Flash หรือ Lite) หรือรอ 1-2 นาทีแล้วทดลองใหม่อีกครั้ง',
                category: 'Rate Limiting'
            };
        }
        if (lower.includes('requested entity') || lower.includes('not found') || lower.includes('404') || lower.includes('unsupported')) {
            return {
                title: 'โมเดลที่เลือกยังไม่เปิดใช้หรือไม่พบแพลตฟอร์ม (Model Not Found / Unsupported API)',
                icon: <Cpu className="w-5 h-5 text-purple-400" />,
                advice: 'โมเดลนี้อาจจะไม่พร้อมใช้งานหรืออยู่นอกขอบเขตของ API Key ปัจจุบันของคุณ กรุณาเลือกสลับรุ่นโมเดลอื่น เช่น เปลี่ยนจากโมเดลระดับพรีเมียม (Pro) มาเป็นตัวประมวลผลทั่วไป (Flash) และทำซ้ำขั้นตอนเดิม',
                category: 'Model Availability'
            };
        }
        if (lower.includes('safety') || lower.includes('blocked') || lower.includes('block') || lower.includes('filter') || lower.includes('candidate')) {
            return {
                title: 'ขออภัย ข้อความหรือภาพขัดต่อนโยบายความปลอดภัย (Safety & Content Block)',
                icon: <ShieldAlert className="w-5 h-5 text-orange-400" />,
                advice: 'ระบบคัดกรองเนื้อหาของ Google AI ค้นพบคำสำคัญหรือรายละเอียดที่เกี่ยวกับข้อมูลที่อาจจะไม่เหมาะสม ขัดต่อข้อกำหนด หรือ ละเมิดลิขสิทธิ์ กรุณาเขียนข้อความกระตุ้น (Prompt) เสียใหม่โดยหลีกเลี่ยงบริบทที่ทริกเกอร์ฟิลเตอร์นี้',
                category: 'Safety Policy'
            };
        }
        return {
            title: 'เกิดข้อผิดพลาดในการประมวลผล (API Execution Failure)',
            icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
            advice: 'เซิร์ฟเวอร์ตอบรับคำร้องด้วยข้อผิดพลาด ระบบแนะให้คุณตรวจสอบการเชื่อมต่ออินเทอร์เน็ต พรอมต์รูปภาพ หรือเปลี่ยนตัวเลือกรูปแบบของภาพ และลองส่งคำขอใหม่อีกครั้ง',
            category: 'Standard Runtime Error'
        };
    };

    const analysis = analyzeError(errorMessage);

    const handleCopyDetails = () => {
        const fullDetails = `[AI APP ERROR REPORT]
Timestamp: ${new Date().toISOString()}
Context: ${context}
Active Model: ${activeModel}
Diagnostic Category: ${analysis.category}
Error Title: ${analysis.title}
Raw Error: ${errorMessage}
Advice Offered: ${analysis.advice}`;

        navigator.clipboard.writeText(fullDetails);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 md:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                
                {/* Dark backdrop overlay background (placed behind content) */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" 
                    aria-hidden="true"
                />

                {/* Modal container card (with relative and z-10 to be on top of overlay) */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative z-10 w-full max-w-lg p-6 overflow-hidden text-left bg-gray-900 border border-red-500/50 rounded-xl shadow-2xl"
                >
                    {/* Upper Red Visual Header Indicator */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

                    {/* Top close button & context badge */}
                    <div className="flex items-center justify-between mb-4 mt-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase rounded bg-gray-800 text-gray-400 border border-gray-700">
                            Area: {context}
                        </span>
                        <button 
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Warning Icon and Core Title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-lg shrink-0">
                            {analysis.icon}
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-red-400 leading-tight">
                                {analysis.title}
                            </h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                ประเภท: <span className="text-red-300 font-semibold">{analysis.category}</span> | โมเดลหลัก: <span className="text-blue-400 font-mono font-semibold">{activeModel}</span>
                            </p>
                        </div>
                    </div>

                    {/* Problem Analysis & Dynamic Actionable Advice Box */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            คำแนะนำในการแก้ไขปัญหา:
                        </h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-normal">
                            {analysis.advice}
                        </p>
                    </div>

                    {/* Expandable Technical Diagnostics Code section */}
                    <div className="border border-gray-800 rounded-lg mb-5 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowDiagnostics(!showDiagnostics)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800/40 text-xs font-semibold text-gray-300 hover:text-white transition-all outline-none cursor-pointer"
                        >
                            <span>รายละเอียดข้อผิดพลาดดิบ (Raw Diagnostic Details)</span>
                            {showDiagnostics ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        
                        {showDiagnostics && (
                            <div className="p-3 bg-gray-950 border-t border-gray-800">
                                <pre className="text-[11px] font-mono text-red-300 overflow-auto max-h-40 leading-normal scrollbar-thin whitespace-pre-wrap break-all select-all">
                                    {errorMessage}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Button Actions Footer */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={handleCopyDetails}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-gray-700 transition-all active:scale-95 cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-green-400 animate-ping shadow" />
                                    <span>คัดลอกสำเร็จ!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>คัดลอกรายงานขัดข้อง (Copy)</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-red-900/30 transition-all active:scale-95 cursor-pointer"
                        >
                            ปิดหน้าต่างนี้
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DetailedErrorPopup;
