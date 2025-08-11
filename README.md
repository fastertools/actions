# FasterTools GitHub Actions

[![Test Actions](https://github.com/fastertools/actions/workflows/test.yml/badge.svg)](https://github.com/fastertools/actions/actions/workflows/test.yml)

A collection of production-ready GitHub Actions for the FasterTools ecosystem. Each action is designed with comprehensive error handling, caching, and cross-platform support.

## Migration Notice

We're transitioning from Bash to TypeScript implementations. Both versions are available:

| Action | Bash (v1) | TypeScript (v2) |
|--------|-----------|-----------------|
| Setup FTL | `fastertools/actions/actions/setup-ftl@v1` | `fastertools/actions/setup-ftl-js@v2` |
| FTL Server Up | `fastertools/actions/actions/start-ftl-server@v1` | `fastertools/actions/ftl-server-up@v2` |
| Authenticate FTL | N/A | `fastertools/actions/authenticate-ftl@v2` |
| FTL Eng Deploy | `fastertools/actions/actions/ftl-eng-deploy@v1` | `fastertools/actions/ftl-eng-deploy@v2` |

## TypeScript Actions (v2)

### 📦 [Setup FTL CLI (TypeScript)](setup-ftl-js/)

Modern TypeScript implementation with enhanced error handling and caching.

**Quick Usage:**
```yaml
- uses: fastertools/actions/setup-ftl-js@v2
  with:
    version: 'latest'
    use-cache: true
    install-dependencies: false
```

### 🚀 [FTL Server Up](ftl-server-up/)

Start FTL server with health checking and process management.

**Quick Usage:**
```yaml
- uses: fastertools/actions/ftl-server-up@v2
  with:
    port: 8080
    timeout: 30
```

### 🔐 [Authenticate FTL](authenticate-ftl/)

OAuth2 authentication for FTL services.

**Quick Usage:**
```yaml
- uses: fastertools/actions/authenticate-ftl@v2
  with:
    method: 'oauth'
    client-id: ${{ secrets.FTL_CLIENT_ID }}
    client-secret: ${{ secrets.FTL_CLIENT_SECRET }}
```

### 🚢 [FTL Engineering Deploy](ftl-eng-deploy/)

Deploy applications to FTL engineering environments.

**Quick Usage:**
```yaml
- uses: fastertools/actions/ftl-eng-deploy@v2
  with:
    project: 'my-project'
    environment: 'staging'
    client-id: ${{ secrets.FTL_CLIENT_ID }}
    client-secret: ${{ secrets.FTL_CLIENT_SECRET }}
```

## Bash Actions (v1 - Legacy)

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

### 🚀 [Start FTL Server](actions/start-ftl-server/)

Start the FTL server in background with health checks and process management.

**Quick Usage:**
```yaml
- uses: fastertools/actions/actions/start-ftl-server@v1
  with:
    port: 8080
    build: true
```

[📚 Full Documentation →](actions/start-ftl-server/README.md)

### 🛑 [Stop FTL Server](actions/stop-ftl-server/)

Gracefully stop a running FTL server (optional - server stops automatically at job end).

**Quick Usage:**
```yaml
- uses: fastertools/actions/actions/stop-ftl-server@v1
  with:
    server-pid: ${{ steps.start.outputs.server-pid }}
```

[📚 Full Documentation →](actions/stop-ftl-server/README.md)

### 🚢 [FTL Engineering Deploy](actions/ftl-eng-deploy/)

Deploy FTL applications to engineering environments with OAuth2 authentication.

**Quick Usage:**
```yaml
- uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
  with:
    environment: staging
```

**Features:**
- ✅ OAuth2 M2M authentication  
- ✅ Multi-environment support  
- ✅ Deployment tracking  
- ✅ Configurable timeouts  
- ✅ Async deployment option  

[📚 Full Documentation →](actions/ftl-eng-deploy/README.md)

## Repository Structure

```
├── .github/
│   └── workflows/
│       └── test.yml          # Test all actions
├── actions/
│   ├── setup-ftl/            # FTL CLI installer action
│   │   ├── action.yml        # Action definition
│   │   ├── README.md         # Action documentation
│   │   └── CHANGELOG.md      # Action changelog
│   ├── start-ftl-server/     # Server lifecycle management
│   │   ├── action.yml        # Action definition
│   │   └── README.md         # Action documentation
│   ├── stop-ftl-server/      # Server shutdown action
│   │   ├── action.yml        # Action definition
│   │   └── README.md         # Action documentation
│   └── ftl-eng-deploy/       # Engineering deployment action
│       ├── action.yml        # Action definition
│       └── README.md         # Action documentation
├── CHANGELOG.md              # Monorepo changelog
├── LICENSE                   # MIT License
└── README.md                 # This file - action portal
```

## Versioning Strategy

Actions in this repository follow a unified versioning strategy:

- **v1**: Bash implementations (legacy, stable)
- **v2**: TypeScript implementations (modern, recommended)
- **Latest Stable**: Use `@v2` for TypeScript or `@v1` for Bash
- **Specific Version**: Use `@v2.0.0` to pin to a specific version
- **Major Version**: Recommended to use `@v2` for non-breaking updates

### Version Tags

- `@v1` - Bash implementations (legacy)
- `@v2` - TypeScript implementations (recommended)
- `@main` - Latest development version (not recommended for production)

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