export interface DownloadOptions {
    maxRetries?: number;
    backoffMs?: number;
    timeout?: number;
}
export declare function downloadWithRetry(url: string, outputPath: string, options?: DownloadOptions): Promise<void>;
export declare function healthCheck(url: string, retries?: number): Promise<boolean>;
