# FTL Engineering Deploy Action

[![Deploy Actions](https://github.com/fastertools/actions/workflows/deploy.yml/badge.svg)](https://github.fastertools/actions/actions/workflows/deploy.yml)

Deploy FTL applications to engineering environments with OAuth2 authentication support.

## Features

- ✅ **OAuth2 Authentication**: Secure M2M (Machine-to-Machine) authentication
- ✅ **Environment Support**: Deploy to staging, production, or custom environments
- ✅ **Flexible Deployment**: Synchronous or asynchronous deployment options
- ✅ **Comprehensive Error Handling**: Production-grade error handling and retry logic
- ✅ **Deployment Tracking**: Capture deployment IDs and URLs for tracking
- ✅ **Debug Mode**: Optional detailed logging for troubleshooting

## Prerequisites

### Required Secrets

You must configure these secrets in your GitHub repository:

1. **`FTL_M2M_APP_CLIENT_ID`**: OAuth2 client ID for machine-to-machine authentication
2. **`FTL_M2M_APP_CLIENT_SECRET`**: OAuth2 client secret for authentication

To add these secrets:
1. Go to your repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add both `FTL_M2M_APP_CLIENT_ID` and `FTL_M2M_APP_CLIENT_SECRET`

## Usage

### Basic Usage

```yaml
- name: Setup FTL CLI
  uses: fastertools/actions/actions/setup-ftl@v1

- name: Deploy to Engineering
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
```

### Advanced Configuration

```yaml
- name: Deploy with Custom Settings
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
  with:
    oauth-url: https://your-auth-server.com/oauth2/token
    scope: 'deploy:production read:metrics'
    project-path: ./my-ftl-project
    wait-for-deployment: true
    deployment-timeout: 600
    debug: true
```

### Complete Workflow Example

```yaml
name: Deploy to Engineering

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup FTL CLI
        uses: fastertools/actions/actions/setup-ftl@v1
        with:
          version: 'latest'
      
      - name: Build Project
        run: |
          ftl build
          ftl test
      
      - name: Deploy to Staging
        uses: fastertools/actions/actions/ftl-eng-deploy@v1
        env:
          FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
          FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
        with:
          wait-for-deployment: true
          deployment-timeout: 300
      
      - name: Verify Deployment
        run: |
          echo "Deployment completed successfully!"
          echo "Deployment ID: ${{ steps.deploy.outputs.deployment-id }}"
          echo "Deployment URL: ${{ steps.deploy.outputs.deployment-url }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `oauth-url` | OAuth token endpoint URL | No | `https://divine-lion-50-staging.authkit.app/oauth2/token` |
| `scope` | OAuth scope for the token request | No | `FTL GitHub Deploy Action` |
| `project-path` | Path to FTL project | No | `.` (current directory) |
| `wait-for-deployment` | Wait for deployment to complete | No | `true` |
| `deployment-timeout` | Maximum time to wait for deployment (seconds) | No | `300` |
| `debug` | Enable debug mode with detailed logging | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `deployment-id` | The deployment ID from the FTL engineering deploy |
| `deployment-url` | URL of the deployed application |
| `deployment-status` | Final status of the deployment (`success`, `failed`, `timeout`, or `started`) |

## Authentication Flow

The action implements the OAuth2 Client Credentials flow:

1. **Token Request**: Uses `FTL_M2M_APP_CLIENT_ID` and `FTL_M2M_APP_CLIENT_SECRET` to request an access token
2. **Token Receipt**: Receives and validates the OAuth2 access token
3. **Authenticated Deploy**: Uses the token to authenticate the `ftl eng deploy` command

### OAuth Request Format

```http
POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={FTL_M2M_APP_CLIENT_ID}
&client_secret={FTL_M2M_APP_CLIENT_SECRET}
&scope={configured_scope}
```

## Environment-Specific Deployments

### Staging Deployment

```yaml
- name: Deploy to Staging
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
  with:
    oauth-url: https://divine-lion-50-staging.authkit.app/oauth2/token
```

### Production Deployment

```yaml
- name: Deploy to Production
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_PROD_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_PROD_CLIENT_SECRET }}
  with:
    oauth-url: https://auth.production.example.com/oauth2/token
    scope: 'deploy:production'
    deployment-timeout: 600
```

## Asynchronous Deployments

For long-running deployments, you can use asynchronous mode:

```yaml
- name: Start Deployment (Async)
  id: deploy
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
  with:
    wait-for-deployment: false  # Don't wait for completion

- name: Continue with Other Tasks
  run: |
    echo "Deployment started in background"
    # Do other work while deployment runs
```

## Error Handling

The action includes comprehensive error handling:

- **Missing Credentials**: Clear error messages if secrets are not configured
- **OAuth Failures**: Detailed error reporting for authentication issues
- **Deployment Failures**: Captures and reports deployment errors
- **Timeout Handling**: Configurable timeout with proper cleanup

### Common Issues and Solutions

#### Missing OAuth Credentials

```yaml
# ERROR: FTL_M2M_APP_CLIENT_ID environment variable is required
# Solution: Add the secret to your repository
```

#### OAuth Token Request Fails

```yaml
# Check the oauth-url and ensure your credentials are correct
- uses: fastertools/actions/actions/ftl-eng-deploy@v1
  with:
    debug: true  # Enable debug mode to see OAuth response
```

#### Deployment Timeout

```yaml
# Increase timeout for large deployments
- uses: fastertools/actions/actions/ftl-eng-deploy@v1
  with:
    deployment-timeout: 900  # 15 minutes
```

## Security Considerations

- **Secrets Management**: Always use GitHub Secrets for credentials
- **Token Masking**: Access tokens are automatically masked in logs
- **Secure Transport**: All OAuth requests use HTTPS
- **Scope Limitation**: Use minimal required scopes for deployments
- **Environment Isolation**: Use different credentials for staging/production

## Debug Mode

Enable debug mode for detailed troubleshooting:

```yaml
- name: Deploy with Debug
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}
  with:
    debug: true
```

Debug mode provides:
- OAuth request/response details (tokens masked)
- Detailed deployment command construction
- Step-by-step execution logging
- Environment variable validation

## Multi-Environment Strategy

```yaml
name: Progressive Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Staging
        uses: fastertools/actions/actions/ftl-eng-deploy@v1
        env:
          FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_STAGING_CLIENT_ID }}
          FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_STAGING_CLIENT_SECRET }}
  
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # GitHub Environment protection
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Production
        uses: fastertools/actions/actions/ftl-eng-deploy@v1
        env:
          FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_PROD_CLIENT_ID }}
          FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_PROD_CLIENT_SECRET }}
        with:
          deployment-timeout: 600
```

## Related Actions

- [`setup-ftl`](../setup-ftl/) - Install FTL CLI and dependencies
- [`start-ftl-server`](../start-ftl-server/) - Start FTL server for testing
- [`stop-ftl-server`](../stop-ftl-server/) - Stop running FTL server

## Troubleshooting

### Enable GitHub Actions Debug Logging

Add these secrets to your repository for verbose logging:
- `ACTIONS_STEP_DEBUG`: Set to `true`
- `ACTIONS_RUNNER_DEBUG`: Set to `true`

### Check Deployment Logs

```yaml
- name: Deploy and Save Logs
  uses: fastertools/actions/actions/ftl-eng-deploy@v1
  env:
    FTL_M2M_APP_CLIENT_ID: ${{ secrets.FTL_M2M_APP_CLIENT_ID }}
    FTL_M2M_APP_CLIENT_SECRET: ${{ secrets.FTL_M2M_APP_CLIENT_SECRET }}

- name: Upload Deployment Logs
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: deployment-logs
    path: ~/ftl-deploy.log
```

## Contributing

1. Fork this repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## License

MIT License - see [LICENSE](../../LICENSE) for details.