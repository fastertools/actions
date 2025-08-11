# Start FTL Server Action

[![Test Actions](https://github.com/fastertools/actions/workflows/test.yml/badge.svg)](https://github.fastertools/actions/actions/workflows/test.yml)

Start the FTL server in background with health checks and process management for GitHub Actions workflows.

## Features

- ✅ **Background Process Management**: Starts server as background daemon with PID tracking
- ✅ **Health Check Verification**: Ensures server is ready before continuing workflow
- ✅ **Comprehensive Error Handling**: Production-grade error handling with detailed diagnostics
- ✅ **Flexible Configuration**: Support for custom ports, config files, and log levels
- ✅ **Process Monitoring**: Built-in process health monitoring and log management
- ✅ **Debug Information**: Optional detailed logging and troubleshooting outputs

## Usage

### Basic Usage

```yaml
- name: Setup FTL CLI
  uses: fastertools/actions/actions/setup-ftl@v1

- name: Start FTL Server
  uses: fastertools/actions/actions/start-ftl-server@v1
```

### Advanced Configuration

```yaml
- name: Start FTL Server with Custom Settings
  uses: fastertools/actions/actions/start-ftl-server@v1
  with:
    port: 9000
    log-level: debug
    health-check-timeout: 60
    config-file: ./ftl-config.toml
```

### Complete Workflow Example

```yaml
name: Deploy with FTL Server

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
      
      - name: Start FTL Server
        uses: fastertools/actions/actions/start-ftl-server@v1
        with:
          port: 8080
          log-level: info
          health-check-timeout: 30
      
      - name: Run Integration Tests
        run: |
          # Server is now running and ready for requests
          curl http://localhost:8080/health
          npm run test:integration
      
      - name: Deploy Application
        run: |
          # Use FTL server for deployment
          ftl deploy --server=http://localhost:8080
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `health-check-timeout` | Maximum time to wait for server health check (seconds) | No | `30` |
| `log-level` | Server log level (`debug`, `info`, `warn`, `error`) | No | `info` |
| `port` | Port for FTL server | No | Auto-detect |
| `config-file` | Path to FTL configuration file | No | - |
| `background` | Run server in background (`true`) or foreground (`false`) | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `server-pid` | Process ID of the running FTL server |
| `server-url` | URL where the FTL server is accessible |
| `health-check-url` | Health check endpoint URL |

## Server Management

### Accessing Server Information

The action outputs can be used in subsequent steps:

```yaml
- name: Start FTL Server
  id: ftl-server
  uses: fastertools/actions/actions/start-ftl-server@v1

- name: Use Server
  run: |
    echo "Server running at: ${{ steps.ftl-server.outputs.server-url }}"
    echo "Health check: ${{ steps.ftl-server.outputs.health-check-url }}"
    echo "Process ID: ${{ steps.ftl-server.outputs.server-pid }}"
```

### Viewing Server Logs

Server logs are automatically written to `~/ftl-server.log`:

```yaml
- name: Check Server Logs
  if: always()  # Run even if previous steps fail
  run: |
    echo "=== FTL Server Logs ==="
    cat ~/ftl-server.log
```

### Server Health Monitoring

The action includes built-in health monitoring, but you can add additional checks:

```yaml
- name: Additional Health Check
  run: |
    # Wait for server to be fully ready
    timeout 60s bash -c 'until curl -f http://localhost:8080/health; do sleep 2; done'
    
    # Verify server is responding correctly
    curl -f http://localhost:8080/api/status
```

## Error Handling

The action includes comprehensive error handling:

- **Input Validation**: All inputs are validated before execution
- **Process Monitoring**: Continuous monitoring of server process health
- **Health Check Verification**: Ensures server is responding before completing
- **Detailed Error Messages**: Clear error messages with debugging information
- **Log Preservation**: Server logs are preserved for troubleshooting

### Common Issues and Solutions

#### Server Fails to Start

```yaml
- name: Debug Server Startup
  if: failure()
  run: |
    echo "=== Server Logs ==="
    cat ~/ftl-server.log || echo "No log file found"
    
    echo "=== Process Status ==="
    ps aux | grep ftl || echo "No FTL process found"
    
    echo "=== Port Status ==="
    netstat -tulpn | grep :8080 || echo "Port 8080 not in use"
```

#### Health Check Timeout

```yaml
- name: Start FTL Server (Extended Timeout)
  uses: fastertools/actions/actions/start-ftl-server@v1
  with:
    health-check-timeout: 120  # Increase timeout for slow environments
    log-level: debug           # Enable debug logging
```

#### Port Conflicts

```yaml
- name: Check Port Availability
  run: |
    # Check if port is already in use
    if netstat -tuln | grep -q ':8080 '; then
      echo "Port 8080 is already in use"
      netstat -tulpn | grep :8080
      exit 1
    fi

- name: Start FTL Server (Custom Port)
  uses: fastertools/actions/actions/start-ftl-server@v1
  with:
    port: 9000  # Use different port
```

## Security Considerations

- Server runs with the same permissions as the GitHub Actions runner
- Logs may contain sensitive information - review log outputs carefully
- Server is only accessible from localhost by default
- Consider using authentication for production deployments

## Limitations

- Currently supports Linux and macOS runners only
- Server runs for the duration of the job only
- No built-in support for HTTPS (use reverse proxy if needed)
- Health check assumes standard HTTP endpoints

## Related Actions

- [`setup-ftl`](../setup-ftl/) - Install FTL CLI and dependencies
- [`stop-ftl-server`](../stop-ftl-server/) - Gracefully stop FTL server (planned)

## Troubleshooting

### Enable Debug Mode

Add debug logging to get detailed information:

```yaml
- name: Start FTL Server (Debug)
  uses: fastertools/actions/actions/start-ftl-server@v1
  with:
    log-level: debug

- name: Show Debug Information
  run: |
    echo "=== Environment ==="
    env | grep -i ftl || echo "No FTL environment variables"
    
    echo "=== Process Tree ==="
    pstree -p $$ || ps -ef | grep -E "(ftl|$$)"
    
    echo "=== Network Status ==="
    ss -tulpn | grep -E "(8080|ftl)" || echo "No FTL network activity"
```

### Manual Server Management

If you need to manually manage the server:

```yaml
- name: Manual Server Start
  run: |
    # Start server manually with custom options
    ftl up --port=8080 --log-level=debug > ~/ftl-manual.log 2>&1 &
    FTL_PID=$!
    echo "Started FTL server with PID: $FTL_PID"
    
    # Save PID for later steps
    echo "FTL_SERVER_PID=$FTL_PID" >> $GITHUB_ENV
    
    # Wait for server
    timeout 30s bash -c 'until curl -f http://localhost:8080/health; do sleep 1; done'
```

## Contributing

1. Fork this repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## License

MIT License - see [LICENSE](../../LICENSE) for details.