import React from 'react';
import ImagePlaceholder from './ImagePlaceholder';
import ImageCard from './ImageCard';
import { AspectRatio } from '../constants';

interface GeneratedImagesDisplayProps {
    loading: boolean;
    loadingCount: number;
    images: string[];
    aspectRatio: AspectRatio;
    processingAction: string | null;
    onSetReference: (imageSrc: string) => void;
    onDescribe: (imageSrc: string, index: number) => void;
    onCaption: (imageSrc: string, index: number) => void;
    onRemoveText: (imageSrc: string, index: number) => void;
    onExpand: (imageSrc: string, index: number, targetAspectRatio: AspectRatio) => void;
}

export const GeneratedImagesDisplay: React.FC<GeneratedImagesDisplayProps> = ({
    loading,
    loadingCount,
    images,
    aspectRatio,
    processingAction,
    onSetReference,
    onDescribe,
    onCaption,
    onRemoveText,
    onExpand
}) => {
    return (
        <main className="mb-10">
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
                    {Array.from({ length: loadingCount }).map((_, index) => (
                        <ImagePlaceholder key={index} aspectRatio={aspectRatio} />
                    ))}
                </div>
            ) : images.length > 0 ? (
                <div className={`grid ${images.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'} gap-6 w-full ${images.length === 1 ? 'max-w-3xl' : 'max-w-5xl'} mx-auto`}>
                    {images.map((src, index) => (
                        <ImageCard
                            key={index}
                            src={src}
                            index={index}
                            aspectRatio={aspectRatio}
                            processingAction={processingAction}
                            onEdit={onSetReference}
                            onDescribe={onDescribe}
                            onCaption={onCaption}
                            onRemoveText={onRemoveText}
                            onExpand={onExpand}
                        />
                    ))}
                </div>
            ) : (
                <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-lg text-center text-gray-500 min-h-[300px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h2 className="mt-4 text-2xl font-semibold text-gray-300">Your Creations Will Appear Here</h2>
                </div>
            )}
        </main>
    );
};

export default GeneratedImagesDisplay;
