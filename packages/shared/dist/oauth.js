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
exports.FTLAuthClient = void 0;
exports.obtainOAuthToken = obtainOAuthToken;
exports.cacheOAuthToken = cacheOAuthToken;
exports.getCachedOAuthToken = getCachedOAuthToken;
const core = __importStar(require("@actions/core"));
async function obtainOAuthToken(config) {
    const { url, clientId, clientSecret, scope = 'deploy' } = config;
    // Mask sensitive credentials immediately
    core.setSecret(clientId);
    core.setSecret(clientSecret);
    try {
        // Prepare the request body
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('scope', scope);
        // Make the OAuth request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params
        });
        if (!response.ok) {
            throw new Error(`OAuth authentication failed: ${response.status} ${response.statusText}`);
        }
        const tokenResponse = await response.json();
        // Extract and mask the access token
        const accessToken = tokenResponse.access_token;
        if (accessToken) {
            core.setSecret(accessToken);
        }
        // Build the token object with defaults
        const token = {
            accessToken: accessToken || '',
            tokenType: tokenResponse.token_type || 'Bearer',
            expiresIn: tokenResponse.expires_in || 3600
        };
        return token;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`OAuth token acquisition failed: ${errorMessage}`);
    }
}
function cacheOAuthToken(token) {
    const expiryTimestamp = Date.now() + (token.expiresIn * 1000);
    core.exportVariable('FTL_AUTH_TOKEN', token.accessToken);
    core.exportVariable('FTL_TOKEN_TYPE', token.tokenType);
    core.exportVariable('FTL_TOKEN_EXPIRES', expiryTimestamp.toString());
}
function getCachedOAuthToken() {
    const accessToken = process.env.FTL_AUTH_TOKEN;
    const tokenType = process.env.FTL_TOKEN_TYPE;
    const expiresString = process.env.FTL_TOKEN_EXPIRES;
    // Check if all required fields are present
    if (!accessToken || !tokenType || !expiresString) {
        return null;
    }
    // Parse and validate expiry timestamp
    const expiryTimestamp = parseInt(expiresString, 10);
    if (isNaN(expiryTimestamp)) {
        return null;
    }
    // Check if token is expired
    const now = Date.now();
    if (expiryTimestamp <= now) {
        return null;
    }
    // Calculate remaining seconds
    const remainingMs = expiryTimestamp - now;
    const remainingSeconds = Math.floor(remainingMs / 1000);
    return {
        accessToken,
        tokenType,
        expiresIn: remainingSeconds
    };
}
class FTLAuthClient {
    async authenticate(options) {
        // CRAWL Phase: Minimal stub implementation
        console.log('🔐 Stub OAuth authentication', { options });
        return {
            accessToken: 'stub-token',
            tokenType: 'Bearer',
            expiresIn: 3600
        };
    }
    async validateToken(token) {
        // CRAWL Phase: Minimal stub implementation
        console.log('✅ Stub token validation', { tokenLength: token.length });
        return true;
    }
    async refreshToken(token) {
        // CRAWL Phase: Minimal stub implementation
        console.log('🔄 Stub token refresh', { tokenLength: token.length });
        return {
            accessToken: 'refreshed-stub-token',
            tokenType: 'Bearer',
            expiresIn: 3600
        };
    }
    static fromEnvironment() {
        // CRAWL Phase: Minimal stub implementation
        console.log('🌍 Stub environment authentication');
        return new FTLAuthClient();
    }
}
exports.FTLAuthClient = FTLAuthClient;
