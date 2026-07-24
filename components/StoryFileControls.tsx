import React, { useRef, useState } from 'react';

interface StoryFileControlsProps {
    fileName: string;
    setFileName: (name: string) => void;
    story: string;
    setStory: React.Dispatch<React.SetStateAction<string>>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onError: (msg: string) => void;
}

export const StoryFileControls: React.FC<StoryFileControlsProps> = ({
    fileName,
    setFileName,
    story,
    setStory,
    textareaRef,
    onError
}) => {
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [showFileOptions, setShowFileOptions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setFileContent(text);
                setShowFileOptions(true);
            };
            reader.readAsText(file);
        }
        event.target.value = '';
    };

    const handleFileOpen = (mode: 'overwrite' | 'insert' | 'append') => {
        if (!fileContent) return;

        if (mode === 'overwrite') {
            setStory(fileContent);
            if (fileInputRef.current?.files?.[0]) {
                setFileName(fileInputRef.current.files[0].name);
            }
        } else if (mode === 'append') {
            setStory(prev => (prev ? prev + '\n' : '') + fileContent);
        } else if (mode === 'insert' && textareaRef.current) {
            const { selectionStart, value } = textareaRef.current;
            const newStory = value.slice(0, selectionStart) + fileContent + value.slice(selectionStart);
            setStory(newStory);
        }
        setShowFileOptions(false);
        setFileContent(null);
    };

    const handleSaveFile = () => {
        if (!story) {
            onError("There is no story to save.");
            return;
        }
        const blob = new Blob([story], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <>
            {showFileOptions && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 space-y-3 border border-gray-700 shadow-2xl">
                        <h4 className="text-lg font-semibold text-white">How to open file?</h4>
                        <button onClick={() => handleFileOpen('overwrite')} className="w-full text-left p-3 bg-gray-700 hover:bg-blue-600 rounded-md transition-colors cursor-pointer">เขียนทับข้อมูลเดิม</button>
                        <button onClick={() => handleFileOpen('insert')} className="w-full text-left p-3 bg-gray-700 hover:bg-blue-600 rounded-md transition-colors cursor-pointer">เขียนแทรกข้อมูลเดิม</button>
                        <button onClick={() => handleFileOpen('append')} className="w-full text-left p-3 bg-gray-700 hover:bg-blue-600 rounded-md transition-colors cursor-pointer">เขียนต่อท้ายข้อมูลเดิม</button>
                        <button onClick={() => setShowFileOptions(false)} className="mt-2 w-full text-left p-2 bg-gray-600 hover:bg-gray-500 rounded-md text-center transition-colors cursor-pointer">Cancel</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex-1 text-center py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium cursor-pointer"
                >
                    Open
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt" />

                <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="flex-grow bg-gray-900 border border-gray-700 text-white rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm px-3"
                    placeholder="story.txt"
                />

                <button 
                    type="button" 
                    onClick={handleSaveFile} 
                    className="flex-1 text-center py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium cursor-pointer"
                >
                    Save
                </button>
            </div>
        </>
    );
};

export default StoryFileControls;
