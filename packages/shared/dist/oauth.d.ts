export interface OAuthConfig {
    url: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
}
export interface OAuthToken {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
}
export declare function obtainOAuthToken(config: OAuthConfig): Promise<OAuthToken>;
export declare function cacheOAuthToken(token: OAuthToken): void;
export declare function getCachedOAuthToken(): OAuthToken | null;
export interface AuthOptions {
    clientId?: string;
    clientSecret?: string;
    interactive?: boolean;
    scope?: string[];
}
export interface AuthToken {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
}
export declare class FTLAuthClient {
    authenticate(options: AuthOptions): Promise<AuthToken>;
    validateToken(token: string): Promise<boolean>;
    refreshToken(token: string): Promise<AuthToken>;
    static fromEnvironment(): FTLAuthClient | null;
}
