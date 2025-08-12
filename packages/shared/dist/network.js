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
exports.downloadWithRetry = downloadWithRetry;
exports.checkUrlExists = checkUrlExists;
exports.healthCheck = healthCheck;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
async function downloadWithRetry(url, outputPath, options = {}) {
    const { maxRetries = 3, backoffMs = 5000, timeout = 30000 } = options;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Create AbortController for timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), timeout);
            try {
                // Make the HTTP request
                const response = await fetch(url, {
                    signal: abortController.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                // Get the response data
                const data = await response.arrayBuffer();
                // Create directory if it doesn't exist
                const dir = path.dirname(outputPath);
                await fs.mkdir(dir, { recursive: true });
                // Write the file
                await fs.writeFile(outputPath, Buffer.from(data));
                return; // Success!
            }
            catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // If this was the last attempt, don't wait
            if (attempt === maxRetries - 1) {
                break;
            }
            // Calculate exponential backoff delay
            const delay = backoffMs * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(() => resolve(), delay));
        }
    }
    // If we get here, all attempts failed
    throw new Error(`Download failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}
async function checkUrlExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    }
    catch (error) {
        return false;
    }
}
async function healthCheck(url, retries = 3) {
    // CRAWL Phase: Minimal stub implementation
    console.log(`🔍 Stub health check: ${url} (retries: ${retries})`);
    return true;
}
