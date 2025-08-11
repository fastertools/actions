import { ChildProcess } from 'child_process';
export interface HealthCheckOptions {
    timeoutSeconds?: number;
    intervalMs?: number;
    expectedStatus?: number;
    requestTimeoutMs?: number;
}
export interface ProcessOptions {
    timeoutMs?: number;
    forceful?: boolean;
}
export declare function waitForHealthCheck(url: string, options?: HealthCheckOptions): Promise<void>;
export declare function killProcessGracefully(process: ChildProcess, options?: ProcessOptions): Promise<void>;
export declare function spawnAsync(command: string, args: string[]): Promise<ChildProcess>;
export declare function setupProcessCleanup(processes: ChildProcess[]): void;
