"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPlatform = detectPlatform;
exports.getDownloadUrl = getDownloadUrl;
function detectPlatform() {
    // CRAWL Phase: Minimal stub implementation
    return {
        os: 'linux',
        arch: 'x64',
        runner: 'ubuntu-latest'
    };
}
function getDownloadUrl(version, platform) {
    // CRAWL Phase: Minimal stub implementation
    return `https://github.com/TBD54566975/ftl/releases/download/v${version}/ftl-${platform.os}-${platform.arch}.tar.gz`;
}
