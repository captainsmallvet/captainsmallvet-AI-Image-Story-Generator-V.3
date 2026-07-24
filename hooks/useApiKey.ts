import { useState, useEffect, useCallback } from 'react';
import { updateActiveApiKey } from '../services/geminiService';

export const useApiKey = (onError: (msg: string) => void) => {
    const [apiKeyInput, setApiKeyInput] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [keyCopied, setKeyCopied] = useState<boolean>(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('user_api_key');
        const defaultKey = process.env.API_KEY;
        
        if (savedKey) {
            setApiKeyInput(savedKey);
            updateActiveApiKey(savedKey);
        } else if (defaultKey && defaultKey !== 'PLACEHOLDER_API_KEY' && defaultKey.length > 5) {
            setApiKeyInput(defaultKey);
            updateActiveApiKey(defaultKey);
        } else {
            setApiKeyInput('no API key');
        }
    }, []);

    const handleSendKey = useCallback(() => {
        if (!apiKeyInput || apiKeyInput === 'no API key' || apiKeyInput.trim() === '') {
            onError("Please enter a valid API key.");
            return;
        }
        localStorage.setItem('user_api_key', apiKeyInput.trim());
        updateActiveApiKey(apiKeyInput.trim());
        setStatusMessage("Applied & Saved!");
        setTimeout(() => setStatusMessage(""), 3000);
    }, [apiKeyInput, onError]);

    const handleCopyKey = useCallback(() => {
        if (apiKeyInput && apiKeyInput !== 'no API key') {
            navigator.clipboard.writeText(apiKeyInput);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 2000);
            setStatusMessage("Copied!");
            setTimeout(() => setStatusMessage(""), 2000);
        }
    }, [apiKeyInput]);

    const handleClearKey = useCallback(() => {
        setApiKeyInput('');
        localStorage.removeItem('user_api_key');
        updateActiveApiKey(process.env.API_KEY || '');
        setStatusMessage("Cleared.");
        setTimeout(() => setStatusMessage(""), 2000);
    }, []);

    return {
        apiKeyInput,
        setApiKeyInput,
        statusMessage,
        keyCopied,
        handleSendKey,
        handleCopyKey,
        handleClearKey
    };
};
