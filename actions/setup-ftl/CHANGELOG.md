# Changelog

All notable changes to the Setup FTL CLI action will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-25

### Added
- Initial release of Setup FTL CLI action with V2 hardened shell implementation
- Production-grade error handling with `set -euo pipefail` and comprehensive error traps
- Network resilience with exponential backoff retry logic for downloads
- Input validation and sanitization for all parameters
- Debug mode with detailed environment and troubleshooting information
- Enhanced platform detection with verification across Linux and macOS
- Comprehensive installation verification for FTL CLI and all dependencies
- Intelligent caching with proper cache keys based on OS, architecture, and version
- Support for Spin WebAssembly runtime, wkg package tool, and Docker Buildx
- Cross-platform support: Ubuntu (x64/ARM64) and macOS (x64/ARM64)
- Structured logging with GitHub Actions groups and progress indicators
- Complete test suite with matrix testing across multiple platforms
- Comprehensive documentation with troubleshooting guides

### Features
- **Zero Dependencies**: Pure shell implementation using only standard commands
- **Production Ready**: Extensive error handling prevents silent failures  
- **Network Resilient**: Automatic retry with exponential backoff
- **Debug Friendly**: Optional verbose mode for troubleshooting
- **Fast Caching**: Intelligent dependency caching for performance
- **Cross Platform**: Full support for GitHub's Linux and macOS runners

### Supported Inputs
- `version`: FTL CLI version to install (default: `latest`)
- `install-dependencies`: Install Spin, wkg, Docker Buildx (default: `true`)
- `cache-dependencies`: Enable caching for faster runs (default: `true`)
- `debug`: Enable debug mode with detailed logging (default: `false`)

### Supported Outputs
- `ftl-version`: The resolved and installed FTL CLI version

### Platform Support
- Ubuntu Latest (x64/ARM64) ✅
- Ubuntu 20.04 (x64/ARM64) ✅  
- macOS Latest (x64/ARM64) ✅
- macOS 13 (x64/ARM64) ✅
- Windows (x64/ARM64) ❌ (not yet supported)

---

## Version Tag Format

This action follows the GitHub Actions best practices for version tagging:

- `setup-ftl/v1.0.0` - Specific version release
- `setup-ftl/v1.0` - Minor version tag  
- `setup-ftl/v1` - Major version tag (recommended for users)

## Usage

```yaml
- uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    install-dependencies: true
```

For the complete usage documentation, see [README.md](README.md).