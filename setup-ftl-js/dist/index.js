'use strict';

var core = require('@actions/core');
var tc = require('@actions/tool-cache');
var exec = require('@actions/exec');
var path = require('path');
var fs = require('fs/promises');
var os = require('os');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var core__namespace = /*#__PURE__*/_interopNamespaceDefault(core);
var tc__namespace = /*#__PURE__*/_interopNamespaceDefault(tc);
var exec__namespace = /*#__PURE__*/_interopNamespaceDefault(exec);
var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);
var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var os__namespace = /*#__PURE__*/_interopNamespaceDefault(os);

function isValidSemver(version) {
    if (version === 'latest')
        return true;
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
}
async function resolveVersion(version) {
    if (version === 'latest' || version === '') {
        try {
            const response = await fetch('https://api.github.com/repos/fastertools/ftl-cli/releases');
            if (!response.ok) {
                throw new Error(`GitHub API responded with ${response.status}`);
            }
            const releases = await response.json();
            // Find latest release with cli-v prefix
            const latestRelease = releases.find(r => r.tag_name.startsWith('cli-v'));
            if (!latestRelease) {
                throw new Error('No release found with cli-v prefix');
            }
            return latestRelease.tag_name.replace(/^cli-v/, '');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to resolve latest version: ${errorMessage}`);
        }
    }
    if (!isValidSemver(version)) {
        throw new Error(`Invalid version format: ${version}. Expected semver format (e.g., 1.0.0) or 'latest'`);
    }
    return version;
}
function getBinaryUrl(version, platform) {
    // Map architecture
    const archMap = {
        'x64': 'x86_64',
        'arm64': 'aarch64'
    };
    const ftlArch = archMap[platform.arch] || platform.arch;
    // Build asset name based on platform
    let assetName;
    if (platform.os === 'darwin') {
        // macOS uses: ftl-{arch}-apple-darwin
        assetName = `ftl-${ftlArch}-apple-darwin`;
    }
    else if (platform.os === 'linux') {
        // Linux uses: ftl-{arch}-unknown-linux-gnu
        assetName = `ftl-${ftlArch}-unknown-linux-gnu`;
    }
    else {
        throw new Error(`Unsupported platform: ${platform.os}`);
    }
    const versionTag = `cli-v${version}`;
    return `https://github.com/fastertools/ftl-cli/releases/download/${versionTag}/${assetName}`;
}
async function installDependencies() {
    core__namespace.info('💿 Installing dependencies...');
    try {
        // Install Spin CLI as a dependency
        // Use bash -c to handle the pipe properly
        await exec__namespace.exec('bash', ['-c', 'curl -fsSL https://developer.fermyon.com/downloads/install.sh | bash']);
        core__namespace.info('✅ Dependencies installed successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        core__namespace.warning(`Failed to install dependencies: ${errorMessage}`);
        // Don't fail the entire action for dependency installation failures
    }
}
async function run() {
    try {
        core__namespace.startGroup('🏗️ Setting up FTL CLI');
        // Get inputs
        const versionInput = core__namespace.getInput('version') || 'latest';
        const useCache = core__namespace.getBooleanInput('use-cache');
        core__namespace.info(`Requested version: ${versionInput}`);
        core__namespace.info(`Use cache: ${useCache}`);
        // Detect platform
        const platform = detectPlatform();
        core__namespace.info(`Detected platform: ${platform.os}/${platform.arch} (${platform.runner})`);
        // Resolve version
        const version = await resolveVersion(versionInput);
        core__namespace.info(`Resolved version: ${version}`);
        let ftlPath = '';
        let cacheHit = false;
        // Check cache if enabled
        if (useCache) {
            ftlPath = tc__namespace.find('ftl', version, platform.arch);
            if (ftlPath) {
                core__namespace.info(`📋 Found cached FTL CLI version ${version} at ${ftlPath}`);
                cacheHit = true;
            }
        }
        // Download and install if not cached
        if (!ftlPath) {
            const downloadUrl = getBinaryUrl(version, platform);
            core__namespace.info(`Downloading FTL CLI from: ${downloadUrl}`);
            try {
                // Download the binary
                const downloadPath = await tc__namespace.downloadTool(downloadUrl);
                // The FTL CLI is distributed as a raw binary, not an archive
                // Create a directory for the binary
                const binDir = path__namespace.join(process.env.RUNNER_TEMP || '/tmp', `ftl-${version}`);
                await fs__namespace.mkdir(binDir, { recursive: true });
                // Move the binary to the directory with the correct name
                const ftlBinaryPath = path__namespace.join(binDir, 'ftl');
                await fs__namespace.copyFile(downloadPath, ftlBinaryPath);
                // Cache the directory containing the binary
                ftlPath = await tc__namespace.cacheDir(binDir, 'ftl', version, platform.arch);
                core__namespace.info(`💿 FTL CLI ${version} installed to ${ftlPath}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                    throw new Error(`Version ${version} not found. Please check if this version exists in the FTL releases.`);
                }
                if (errorMessage.includes('Network timeout') || errorMessage.includes('timeout')) {
                    throw new Error(`Download failed: Network timeout. Please try again.`);
                }
                if (errorMessage.includes('Corrupted archive')) {
                    throw new Error(`Extraction failed: ${errorMessage}`);
                }
                throw new Error(`Download failed: ${errorMessage}`);
            }
        }
        // Set executable permissions
        const ftlBinary = path__namespace.join(ftlPath, 'ftl');
        try {
            await fs__namespace.chmod(ftlBinary, '755');
        }
        catch (error) {
            core__namespace.warning(`Failed to set executable permissions: ${error}`);
        }
        // Add to PATH
        core__namespace.addPath(ftlPath);
        // Verify installation
        try {
            await exec__namespace.exec(ftlBinary, ['--version']);
            core__namespace.info('✅ FTL CLI installation verified');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`FTL CLI verification failed: ${errorMessage}`);
        }
        // Always install dependencies - they're called dependencies for a reason!
        await installDependencies();
        // Set outputs
        core__namespace.setOutput('version', version);
        core__namespace.setOutput('ftl-path', ftlPath);
        core__namespace.setOutput('cached', cacheHit.toString());
        core__namespace.info(`✅ FTL CLI setup completed successfully`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        core__namespace.setFailed(`Setup failed: ${errorMessage}`);
    }
    finally {
        core__namespace.endGroup();
    }
}
// Run if this is the main module
if (require.main === module) {
    run();
}
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
            const nodeOS = os__namespace.platform();
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
            const nodeArch = os__namespace.arch();
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

exports.detectPlatform = detectPlatform;
exports.getDownloadUrl = getDownloadUrl;
exports.getPlatformDownloadName = getPlatformDownloadName;
exports.run = run;
