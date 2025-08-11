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
