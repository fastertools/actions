import { ChildProcess } from 'child_process';
export declare function spawnAsync(command: string, args: string[]): Promise<ChildProcess>;
export declare function setupProcessCleanup(processes: ChildProcess[]): void;
