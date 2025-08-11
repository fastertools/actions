import * as core from '@actions/core'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs/promises'
import { waitForHealthCheck, killProcessGracefully } from '@fastertools/shared'

interface ServerStartupOptions {
  port: string
  timeout: number
  configFile?: string
  workingDirectory?: string
  args?: string
  healthEndpoint?: string
  healthMethod?: string
  healthBody?: string
  skipHealthCheck: boolean
  envVars?: string
}

function validatePort(portStr: string): number {
  const port = parseInt(portStr, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${portStr}. Port must be between 1 and 65535.`)
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
  const args = ['serve', '--port', options.port]
  
  if (options.configFile) {
    args.push('--config', options.configFile)
  }
  
  if (options.args) {
    const additionalArgs = options.args.split(/\s+/).filter(arg => arg.length > 0)
    args.push(...additionalArgs)
  }
  
  return args
}

function parseEnvironmentVariables(envVarsStr?: string): Record<string, string> {
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

function buildSpawnEnvironment(customEnvVars: Record<string, string>): Record<string, string> {
  const env = { ...process.env }
  
  // Add custom environment variables
  Object.assign(env, customEnvVars)
  
  return env
}

function setupProcessEventHandlers(ftlProcess: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false
    
    const handleResolve = () => {
      if (!resolved) {
        resolved = true
        resolve()
      }
    }
    
    const handleReject = (error: Error) => {
      if (!resolved) {
        resolved = true
        reject(error)
      }
    }
    
    // Handle process errors
    ftlProcess.on('error', (error) => {
      handleReject(new Error(`Server startup failed: ${error.message}`))
    })
    
    // Handle unexpected exits
    ftlProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        handleReject(new Error(`FTL server process exited unexpectedly with code ${code}`))
      } else if (signal) {
        handleReject(new Error(`FTL server process terminated by signal ${signal}`))
      }
    })
    
    // Capture and log stdout
    if (ftlProcess.stdout) {
      ftlProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim()
        if (output) {
          core.info(`Server stdout: ${output}`)
        }
      })
    }
    
    // Capture and log stderr  
    if (ftlProcess.stderr) {
      ftlProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString().trim()
        if (output) {
          core.info(`Server stderr: ${output}`)
        }
      })
    }
    
    // Give the process a moment to start
    setTimeout(handleResolve, 100)
  })
}

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
    const healthEndpoint = core.getInput('health-endpoint')
    const healthMethod = core.getInput('health-method')
    const healthBody = core.getInput('health-body')
    const skipHealthCheck = core.getBooleanInput('skip-health-check')
    const envVars = core.getInput('env-vars')
    
    const options: ServerStartupOptions = {
      port: port.toString(),
      timeout,
      configFile,
      workingDirectory,
      args,
      healthEndpoint,
      healthMethod,
      healthBody,
      skipHealthCheck,
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
    
    const spawnOptions: any = {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv
    }
    
    if (options.workingDirectory) {
      spawnOptions.cwd = options.workingDirectory
    }
    
    // Start the FTL server process
    core.info('Starting FTL server process...')
    const ftlProcess = spawn('ftl', ftlArgs, spawnOptions)
    
    if (!ftlProcess.pid) {
      throw new Error('Failed to start FTL server process')
    }
    
    // Setup process event handlers
    await setupProcessEventHandlers(ftlProcess)
    
    // Setup cleanup handlers
    setupProcessCleanupHandlers(ftlProcess)
    
    // Export process information
    const serverUrl = `http://localhost:${options.port}`
    core.exportVariable('FTL_SERVER_URL', serverUrl)
    core.exportVariable('FTL_SERVER_PID', ftlProcess.pid.toString())
    
    core.info(`FTL server started with PID: ${ftlProcess.pid}`)
    core.info(`Server process ID: ${ftlProcess.pid}`)
    
    // Perform health check unless skipped
    if (!options.skipHealthCheck) {
      const healthUrl = options.healthEndpoint 
        ? `${serverUrl}${options.healthEndpoint}` 
        : `${serverUrl}/health`
      
      core.info(`Performing health check at: ${healthUrl}`)
      
      const healthCheckOptions: any = {
        timeoutSeconds: options.timeout
      }
      
      if (options.healthMethod) {
        healthCheckOptions.method = options.healthMethod
      }
      
      if (options.healthBody) {
        healthCheckOptions.body = options.healthBody
      }
      
      try {
        await waitForHealthCheck(healthUrl, healthCheckOptions)
        core.info('✅ Health check passed')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Health check failed'
        
        // Kill the process if health check fails
        try {
          await killProcessGracefully(ftlProcess, { timeoutMs: 10000, forceful: true })
        } catch (killError) {
          core.warning(`Failed to kill process after health check failure: ${killError}`)
        }
        
        throw new Error(errorMessage)
      }
    } else {
      core.info('⚠️ Skipping health check as requested')
    }
    
    // Set outputs
    core.setOutput('server-url', serverUrl)
    core.setOutput('pid', ftlProcess.pid.toString())
    core.setOutput('status', 'running')
    
    core.info(`✅ FTL server started successfully at ${serverUrl}`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(errorMessage)
  } finally {
    core.endGroup()
  }
}

// Export for testing
export { run }

// Run if this is the main module
if (require.main === module) {
  run()
}