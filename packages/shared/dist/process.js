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
exports.waitForHealthCheck = waitForHealthCheck;
exports.killProcessGracefully = killProcessGracefully;
exports.spawnAsync = spawnAsync;
exports.setupProcessCleanup = setupProcessCleanup;
const core = __importStar(require("@actions/core"));
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function waitForHealthCheck(url, options = {}) {
    const { timeoutSeconds = 30, intervalMs = 2000, expectedStatus, requestTimeoutMs } = options;
    const timeoutMs = timeoutSeconds * 1000;
    const maxAttempts = Math.ceil(timeoutMs / intervalMs) + 1;
    core.info('⏳ Waiting for server to be ready...');
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const controller = new AbortController();
            // Set request timeout if specified - but only create timer, don't rely on it for successful case
            let requestTimeout;
            if (requestTimeoutMs && requestTimeoutMs > 0) {
                requestTimeout = setTimeout(() => {
                    controller.abort();
                }, requestTimeoutMs);
            }
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });
            // Clear request timeout immediately after successful response
            if (requestTimeout) {
                clearTimeout(requestTimeout);
            }
            if (response.ok) {
                // Check expected status if provided
                if (expectedStatus && response.status !== expectedStatus) {
                    // Status doesn't match, continue waiting
                }
                else {
                    core.info('✅ Server health check passed');
                    return;
                }
            }
            // HTTP error or wrong status, continue retrying
        }
        catch (error) {
            // Network error or timeout, continue retrying
        }
        // If this isn't the last attempt, wait before retrying
        if (attempt < maxAttempts - 1) {
            await delay(intervalMs);
        }
    }
    throw new Error(`Server health check failed after ${timeoutSeconds}s timeout`);
}
async function killProcessGracefully(process, options = {}) {
    const { timeoutMs = 10000, forceful = true } = options;
    // Check if process is already terminated
    if (process.killed) {
        core.info('Process is already terminated');
        return;
    }
    // Check if PID is available
    if (!process.pid) {
        throw new Error('Cannot kill process: PID is undefined');
    }
    return new Promise((resolve, reject) => {
        // Set up exit handler
        process.on('exit', () => {
            core.info('Process exited gracefully');
            resolve();
        });
        // Try graceful shutdown with SIGTERM
        core.info('Attempting graceful shutdown (SIGTERM)...');
        const killResult = process.kill('SIGTERM');
        if (!killResult) {
            reject(new Error(`Failed to send SIGTERM to process ${process.pid}`));
            return;
        }
        // Set timeout for forceful kill
        const timeout = setTimeout(() => {
            if (forceful) {
                core.warning('Process did not exit gracefully, forcing termination (SIGKILL)...');
                process.kill('SIGKILL');
                resolve();
            }
            else {
                core.warning('Process did not exit within timeout, but forceful termination is disabled');
                resolve();
            }
        }, timeoutMs);
        // Clear timeout if process exits gracefully
        process.on('exit', () => {
            clearTimeout(timeout);
        });
    });
}
async function spawnAsync(command, args) {
    // CRAWL Phase: Minimal stub implementation
    console.log(`🚀 Stub spawn: ${command} ${args.join(' ')}`);
    return {};
}
function setupProcessCleanup(processes) {
    // CRAWL Phase: Minimal stub implementation
    console.log(`🧹 Stub process cleanup for ${processes.length} processes`);
}
