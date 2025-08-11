export interface Platform {
    os: 'linux' | 'darwin' | 'win32';
    arch: 'x64' | 'arm64';
    runner: string;
}
export declare function detectPlatform(): Platform;
export declare function getDownloadUrl(version: string, platform: Platform): string;
