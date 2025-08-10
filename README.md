# FasterTools GitHub Actions

[![Test Actions](https://github.com/fastertools/actions/workflows/test.yml/badge.svg)](https://github.com/fastertools/actions/actions/workflows/test.yml)

A collection of production-ready GitHub Actions for the FasterTools ecosystem. Each action is designed with comprehensive error handling, caching, and cross-platform support.

## Available Actions

### 📦 [Setup FTL CLI](actions/setup-ftl/)

Install the FTL CLI and its dependencies with production-grade reliability.

**Quick Usage:**
```yaml
- uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    install-dependencies: true
```

**Features:**
- ✅ Production hardened shell implementation  
- ✅ Network resilient with retry logic  
- ✅ Comprehensive input validation  
- ✅ Debug mode for troubleshooting  
- ✅ Intelligent dependency caching  
- ✅ Cross-platform support (Linux/macOS x64/ARM64)  

[📚 Full Documentation →](actions/setup-ftl/README.md)

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
├── CHANGELOG.md              # Monorepo changelog
├── LICENSE                   # MIT License
└── README.md                 # This file - action portal
```

## Versioning Strategy

Actions in this repository follow a unified versioning strategy:

- **Latest Stable**: Use `@v1` to automatically get the latest stable release
- **Specific Version**: Use `@v1.2.0` to pin to a specific version
- **Major Version**: Recommended to use `@v1` for non-breaking updates

### Version Tags

- `setup-ftl/v1.0.0` - Initial stable release
- `setup-ftl/v1` - Major version tag (automatically updated)

## Usage Examples

### Setup FTL CLI with Full Dependencies

```yaml
name: Deploy with FTL

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup FTL CLI
        uses: fastertools/actions/actions/setup-ftl@v1
        with:
          version: 'latest'
          install-dependencies: true
          cache-dependencies: true
          
      - name: Deploy Application
        run: |
          ftl build
          ftl deploy
```

### Debug Mode for Troubleshooting

```yaml
- name: Setup FTL CLI (Debug Mode)
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    debug: true  # Enables detailed logging
```

## Supported Platforms

All actions in this repository support:

| Platform | x64 | ARM64 |
|----------|-----|-------|
| Ubuntu Latest | ✅ | ✅ |
| Ubuntu 20.04 | ✅ | ✅ |
| macOS Latest | ✅ | ✅ |
| macOS 13 | ✅ | ✅ |
| Windows | ❌ | ❌ |

## Contributing

1. Fork this repository
2. Create a feature branch for your action
3. Follow the established patterns in existing actions
4. Add comprehensive tests
5. Update documentation
6. Submit a pull request

### Adding a New Action

When adding a new action to this monorepo:

1. Create a new directory under `actions/`
2. Follow the structure of existing actions
3. Include comprehensive error handling
4. Add platform-specific tests
5. Update this README.md

## Development Principles

All actions in this repository follow these principles:

- **Production Ready**: Comprehensive error handling and validation
- **Cross-Platform**: Support for Linux and macOS runners
- **Debuggable**: Clear error messages and optional debug modes  
- **Cached**: Intelligent caching for performance
- **Tested**: Comprehensive test coverage across platforms
- **Documented**: Clear usage examples and troubleshooting guides

## Support

- 📋 [Issues](https://github.com/fastertools/actions/issues) - Report bugs or request features
- 📚 [FTL CLI Documentation](https://github.com/fastertools/ftl-cli) - FTL CLI documentation
- 💬 [Discussions](https://github.com/fastertools/actions/discussions) - Community support

## License

This repository and all actions within it are released under the MIT License. See [LICENSE](LICENSE) for details.

---

*All actions implement hardened shell implementations based on comprehensive risk analysis and production best practices.*