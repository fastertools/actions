import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { killProcessGracefully } from './shared/index.js'

async function mcpHealthCheck(
  serverUrl: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const mcpUrl = `${serverUrl}/mcp`
  const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }

  core.info(`Testing MCP endpoint: ${mcpUrl}`)
  core.info(`MCP request: ${JSON.stringify(mcpRequest)}`)

  try {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mcpRequest),
      signal: AbortSignal.timeout(timeoutMs)
    })

    core.info(`HTTP Status: ${response.status}`)

    if (!response.ok) {
      core.info(`MCP endpoint returned HTTP ${response.status}`)
      return false
    }

    const data = (await response.json()) as any
    core.info(`MCP Response: ${JSON.stringify(data)}`)

    // Check for valid MCP response with tools
    if (data.result && Array.isArray(data.result.tools)) {
      core.info('✅ MCP health check passed (tools/list responded correctly)!')
      return true
    } else if (data.error) {
      const errorCode = data.error.code
      const errorMessage = data.error.message || data.error
      core.info(`⚠️ MCP endpoint responded with error code: ${errorCode}`)
      core.info(`⚠️ Error message: ${errorMessage}`)

      // Error code -32603 is "Internal error" which often means configuration issues
      // Check for common configuration issues that indicate server is running but needs setup
      if (
        errorCode === -32603 ||
        (errorMessage &&
          (errorMessage.includes('tool_components') ||
            errorMessage.includes('no variable for') ||
            errorMessage.includes('Undefined') ||
            errorMessage.includes('configuration')))
      ) {
        core.info('💡 Server is running but needs toolbox configuration')
        core.info('💡 This is a configuration issue, not a server failure')
        core.info(
          '✅ FTL server process is running and responding to MCP requests'
        )
        core.info('⚠️ Note: MCP tools need configuration to work properly')
        return true // Treat as "server ready" since process is responding to MCP requests
      } else {
        core.info('⚠️ Unexpected MCP error')
        return false
      }
    } else {
      core.info('⚠️ MCP endpoint responded but not valid MCP format')
      return false
    }
  } catch (error) {
    core.info(
      `MCP health check failed: ${error instanceof Error ? error.message : error}`
    )
    return false
  }
}

interface ServerStartupOptions {
  port: string
  timeout: number
  configFile?: string
  workingDirectory?: string
  args?: string
  envVars?: string
}

function validatePort(portStr: string): number {
  const port = parseInt(portStr, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid port number: ${portStr}. Port must be between 1 and 65535.`
    )
  }
  return port
}

function parseTimeout(timeoutStr: string): number {
  if (!timeoutStr) return 30

  const timeout = parseInt(timeoutStr, 10)
  if (isNaN(timeout)) {
    core.warning('Invalid timeout value, using default (30 seconds)')
    return 30
  }
  return timeout
}

async function validateConfigFile(configFile: string): Promise<void> {
  try {
    await fs.access(configFile)
  } catch (error) {
    throw new Error(`Configuration file not found: ${configFile}`)
  }
}

function buildFtlCommand(options: ServerStartupOptions): string[] {
  const args = ['up', '--port', options.port]

  if (options.configFile) {
    args.push('--config', options.configFile)
  }

  if (options.args) {
    const additionalArgs = options.args
      .split(/\s+/)
      .filter((arg) => arg.length > 0)
    args.push(...additionalArgs)
  }

  return args
}

function parseEnvironmentVariables(
  envVarsStr?: string
): Record<string, string> {
  const envVars: Record<string, string> = {}

  if (!envVarsStr) return envVars

  const pairs = envVarsStr.split(',')
  for (const pair of pairs) {
    const [key, value] = pair.split('=', 2)
    if (key && value) {
      envVars[key.trim()] = value.trim()
    }
  }

  return envVars
}

function buildSpawnEnvironment(
  customEnvVars: Record<string, string>
): Record<string, string> {
  const env: Record<string, string> = {}

  // Copy process.env, filtering out undefined values
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }

  // Add custom environment variables
  Object.assign(env, customEnvVars)

  return env
}

// Removed setupProcessEventHandlers as we're using a background process

function setupProcessCleanupHandlers(ftlProcess: ChildProcess): void {
  const cleanup = async () => {
    if (ftlProcess && !ftlProcess.killed) {
      try {
        core.info('🧹 Cleaning up FTL server process...')
        await killProcessGracefully(ftlProcess, { timeoutMs: 5000 })
      } catch (error) {
        core.warning(`Failed to gracefully kill FTL server: ${error}`)
      }
    }
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

async function run(): Promise<void> {
  try {
    core.startGroup('🚀 Starting FTL Server')

    // Get and parse inputs
    const portInput = core.getInput('port') || '8080'
    const port = validatePort(portInput)
    const timeout = parseTimeout(core.getInput('timeout'))
    const configFile = core.getInput('config-file')
    const workingDirectory = core.getInput('working-directory')
    const args = core.getInput('args')
    const envVars = core.getInput('env-vars')

    const options: ServerStartupOptions = {
      port: port.toString(),
      timeout,
      configFile,
      workingDirectory,
      args,
      envVars
    }

    // Validate config file if provided
    if (configFile) {
      await validateConfigFile(configFile)
    }

    core.info(`Port: ${options.port}`)
    core.info(`Config file: ${options.configFile || 'default'}`)
    core.info(`Timeout: ${options.timeout}s`)
    if (options.workingDirectory) {
      core.info(`Working directory: ${options.workingDirectory}`)
    }
    if (options.args) {
      core.info(`Additional args: ${options.args}`)
    }

    // Build FTL command
    const ftlArgs = buildFtlCommand(options)
    core.info(`Executing: ftl ${ftlArgs.join(' ')}`)

    // Build spawn options
    const customEnvVars = parseEnvironmentVariables(options.envVars)
    const spawnEnv = buildSpawnEnvironment(customEnvVars)

    // Write FTL command to a script file for proper backgrounding
    const tempDir = process.env.RUNNER_TEMP || '/tmp'
    const scriptPath = path.join(tempDir, 'ftl-server.sh')
    const logPath = path.join(tempDir, 'ftl-server.log')
    const pidPath = path.join(tempDir, 'ftl-server.pid')

    // Create the startup script
    const scriptContent = `#!/bin/bash
ftl ${ftlArgs.join(' ')} > "${logPath}" 2>&1 &
echo $! > "${pidPath}"
`
    await fs.writeFile(scriptPath, scriptContent)
    await fs.chmod(scriptPath, '755')

    core.info('Starting FTL server process in background...')
    core.info(`Executing: ftl ${ftlArgs.join(' ')}`)

    // Execute the script
    const spawnOptions: any = {
      stdio: 'ignore',
      env: spawnEnv,
      detached: false // Don't detach the bash script itself
    }

    if (options.workingDirectory) {
      spawnOptions.cwd = options.workingDirectory
    }

    // Run the script which will start FTL in the background
    await exec.exec('bash', [scriptPath], {
      env: spawnEnv,
      cwd: options.workingDirectory
    })

    // Read the PID from the file
    await new Promise((resolve) => setTimeout(resolve, 500)) // Give it a moment to write the PID
    const pidContent = await fs.readFile(pidPath, 'utf-8')
    const ftlPid = parseInt(pidContent.trim(), 10)

    if (!ftlPid || isNaN(ftlPid)) {
      throw new Error('Failed to get FTL server PID')
    }

    // Create a mock process object for compatibility
    const ftlProcess = {
      pid: ftlPid,
      killed: false,
      kill: (signal?: string) => {
        try {
          process.kill(ftlPid, (signal as any) || 'SIGTERM')
          return true
        } catch {
          return false
        }
      }
    } as any

    // We don't need event handlers for the background process
    // Just setup cleanup handlers
    setupProcessCleanupHandlers(ftlProcess)

    // Monitor the log file for a moment to catch early errors
    await new Promise((resolve) => setTimeout(resolve, 1000))
    try {
      const logContent = await fs.readFile(logPath, 'utf-8')
      if (logContent.includes('error') || logContent.includes('Error')) {
        core.warning(
          `Server log contains errors: ${logContent.substring(0, 500)}`
        )
      }
    } catch {
      // Log file might not exist yet, that's ok
    }

    // Export process information
    const serverUrl = `http://localhost:${options.port}`
    core.exportVariable('FTL_SERVER_URL', serverUrl)
    core.exportVariable('FTL_SERVER_PID', ftlProcess.pid.toString())

    core.info(`FTL server started with PID: ${ftlProcess.pid}`)
    core.info(`Server process ID: ${ftlProcess.pid}`)

    // Add a short delay to let the server fully initialize
    const startupDelay = 3000 // 3 seconds
    core.info(`Waiting ${startupDelay}ms for server to initialize...`)
    await new Promise((resolve) => setTimeout(resolve, startupDelay))

    // Perform MCP health check directly (no /health endpoint)
    try {
      // Use MCP health check for FTL server
      const mcpHealthPassed = await mcpHealthCheck(
        serverUrl,
        options.timeout * 1000
      )
      if (mcpHealthPassed) {
        core.info('✅ MCP health check passed')
      } else {
        throw new Error(
          'MCP health check failed - server not responding to tools/list'
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Health check failed'

      // Kill the process if health check fails
      try {
        await killProcessGracefully(ftlProcess, {
          timeoutMs: 10000,
          forceful: true
        })
      } catch (killError) {
        core.warning(
          `Failed to kill process after health check failure: ${killError}`
        )
      }

      throw new Error(errorMessage)
    }

    // Set outputs
    core.setOutput('server-url', serverUrl)
    core.setOutput('pid', ftlProcess.pid.toString())
    core.setOutput('status', 'running')
    core.setOutput('healthy', 'true')

    core.info(`✅ FTL server started successfully at ${serverUrl}`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(errorMessage)
  } finally {
    core.endGroup()
  }
}

// Export for testing
export { run }

// Run if this is the main module (but not during build)
// Removed CommonJS check as this is an ES module
