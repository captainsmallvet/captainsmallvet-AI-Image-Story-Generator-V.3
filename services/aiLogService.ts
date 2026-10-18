/**
 * AI Execution Tracker & Log Service
 * Tracks execution metrics, requested vs actual responding models, latency, and fallback paths.
 */

export interface AILogEntry {
    id: string;
    timestamp: number;
    action: string;
    requestedModel: string;
    actualModel: string;
    fallbackOccurred: boolean;
    fallbackPath: string[];
    latencyMs: number;
    keySource: 'client-header' | 'server-env' | 'direct-client' | 'client-storage';
    status: 'success' | 'fallback_success' | 'error';
    summary?: string;
    errorDetails?: string;
    environment: 'ai-studio-proxy' | 'direct-client';
}

type LogListener = (logs: AILogEntry[]) => void;

class AILogService {
    private logs: AILogEntry[] = [];
    private listeners: Set<LogListener> = new Set();
    private readonly MAX_LOGS = 50;

    constructor() {
        // Hydrate from sessionStorage if available
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem('ai_execution_logs');
                if (saved) {
                    this.logs = JSON.parse(saved);
                }
            } catch (e) {
                console.warn('Could not load AI execution logs from session storage', e);
            }
        }
    }

    public addLog(entry: Omit<AILogEntry, 'id' | 'timestamp'>): AILogEntry {
        const fullEntry: AILogEntry = {
            ...entry,
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now()
        };

        this.logs.unshift(fullEntry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(0, this.MAX_LOGS);
        }

        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem('ai_execution_logs', JSON.stringify(this.logs));
            } catch (e) {
                // Ignore storage limits
            }
        }

        this.notifyListeners();
        return fullEntry;
    }

    public getLogs(): AILogEntry[] {
        return [...this.logs];
    }

    public getLatestLog(): AILogEntry | null {
        return this.logs.length > 0 ? this.logs[0] : null;
    }

    public clearLogs(): void {
        this.logs = [];
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.removeItem('ai_execution_logs');
            } catch (e) {
                // Ignore
            }
        }
        this.notifyListeners();
    }

    public subscribe(listener: LogListener): () => void {
        this.listeners.add(listener);
        listener(this.getLogs());
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        const currentLogs = this.getLogs();
        this.listeners.forEach(listener => {
            try {
                listener(currentLogs);
            } catch (e) {
                console.error('Error in log listener', e);
            }
        });
    }
}

export const aiLogService = new AILogService();
