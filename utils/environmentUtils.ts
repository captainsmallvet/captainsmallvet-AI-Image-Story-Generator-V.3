/**
 * Environment Detection Utilities
 * Automatically identifies whether the application is running inside the
 * AI Studio preview environment (iframe sandbox) or on an external hosting platform (Vercel, etc.)
 */

export const isAiStudioEnvironment = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname.toLowerCase();
    
    // AI Studio preview domains and Cloud Run instances
    return (
        hostname.includes('aistudio.google.com') ||
        hostname.includes('run.app') ||
        hostname.includes('ais-dev-') ||
        hostname.includes('ais-pre-') ||
        window.self !== window.top // Running inside an iframe
    );
};

/**
 * Determines whether the app should make direct client-side SDK calls (@google/genai)
 * or route through the resilient Server-Side Proxy (/api/ai/...).
 * 
 * - AI Studio Preview: returns false -> use Server-Side Proxy (bypass sandbox iframe constraints)
 * - Vercel / External Domain: returns true -> direct client calls for maximum performance
 */
export const shouldUseDirectClientCalls = (): boolean => {
    // If in AI Studio preview or iframe, prefer Server Proxy to avoid network & sandbox blocks
    if (isAiStudioEnvironment()) {
        return false;
    }
    // External / Vercel / Standalone deployments can run direct client SDK
    return true;
};

/**
 * Resolves standard API endpoints for proxy requests
 */
export const getApiEndpoint = (path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return cleanPath;
};
