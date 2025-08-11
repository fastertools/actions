"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPlatform = detectPlatform;
exports.getPlatformDownloadName = getPlatformDownloadName;
exports.getDownloadUrl = getDownloadUrl;
const os = __importStar(require("os"));
function detectPlatform() {
    // Use GitHub Actions environment first
    const runnerOS = process.env.RUNNER_OS;
    const runnerArch = process.env.RUNNER_ARCH;
    let detectedOS;
    switch (runnerOS) {
        case 'Linux':
            detectedOS = 'linux';
            break;
        case 'macOS':
            detectedOS = 'darwin';
            break;
        case 'Windows':
            throw new Error(`Unsupported platform: ${runnerOS}`);
        case 'linux': // Handle lowercase variants
            detectedOS = 'linux';
            break;
        default:
            // Fallback to Node.js detection
            const nodeOS = os.platform();
            if (nodeOS === 'linux')
                detectedOS = 'linux';
            else if (nodeOS === 'darwin')
                detectedOS = 'darwin';
            else if (nodeOS === 'win32')
                throw new Error(`Unsupported platform: ${nodeOS}`);
            else
                throw new Error(`Unsupported platform: ${nodeOS}`);
    }
    let detectedArch;
    switch (runnerArch) {
        case 'X64':
        case 'x64':
            detectedArch = 'x64';
            break;
        case 'ARM64':
        case 'arm64':
            detectedArch = 'arm64';
            break;
        case 'X86':
            throw new Error(`Unsupported architecture: ${runnerArch}`);
        default:
            // Fallback to Node.js detection
            const nodeArch = os.arch();
            if (nodeArch === 'x64')
                detectedArch = 'x64';
            else if (nodeArch === 'arm64')
                detectedArch = 'arm64';
            else
                throw new Error(`Unsupported architecture: ${nodeArch}`);
    }
    return {
        os: detectedOS,
        arch: detectedArch,
        runner: runnerOS || `${detectedOS}-${detectedArch}`
    };
}
function getPlatformDownloadName(platform) {
    const osMap = { linux: 'linux', darwin: 'darwin' };
    const archMap = { x64: 'x64', arm64: 'arm64' };
    if (platform.os === 'win32') {
        throw new Error(`Unsupported platform for download: ${platform.os}`);
    }
    return `ftl-${osMap[platform.os]}-${archMap[platform.arch]}.tar.gz`;
}
function getDownloadUrl(version, platform) {
    const filename = getPlatformDownloadName(platform);
    return `https://github.com/TBD54566975/ftl/releases/download/v${version}/${filename}`;
}
