# FasterTools Actions Changelog

All notable changes to the FasterTools GitHub Actions monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-25

### Added
- Initial monorepo release with setup-ftl action
- Monorepo structure following GitHub Actions best practices
- Comprehensive test suite with matrix testing across platforms
- Production-ready documentation and troubleshooting guides

### Actions

#### setup-ftl v1.0.0
- Production-hardened FTL CLI installer with V2 shell implementation
- Cross-platform support (Ubuntu/macOS x64/ARM64)
- Comprehensive error handling and network resilience
- Debug mode with detailed troubleshooting capabilities
- Intelligent caching for performance
- Zero external dependencies (pure shell)

## Repository Structure

```
├── .github/
│   └── workflows/
│       └── test.yml          # Test all actions
├── actions/
│   └── setup-ftl/            # FTL CLI installer action
│       ├── action.yml        # Action definition
│       ├── README.md         # Action documentation
│       └── CHANGELOG.md      # Action changelog
├── CHANGELOG.md              # This file
└── README.md                 # Repository portal
```

## Versioning Strategy

Each action in this monorepo follows independent versioning:

### Action Tags Format
- `{action-name}/v{major}.{minor}.{patch}` - Specific version
- `{action-name}/v{major}` - Major version (recommended for users)

### Examples
- `setup-ftl/v1.0.0` - Specific setup-ftl release
- `setup-ftl/v1` - Latest v1.x setup-ftl (recommended)

## Usage

### Setup FTL CLI
```yaml
- uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    install-dependencies: true
```

## Support

- 📋 [Issues](https://github.com/fastertools/actions/issues) - Report bugs or request features
- 💬 [Discussions](https://github.com/fastertools/actions/discussions) - Community support