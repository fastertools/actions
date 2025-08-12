import { execSync } from 'child_process'

const packages = ['setup-ftl', 'ftl-server-up', 'ftl-eng-deploy', 'authenticate-ftl']

function buildAction(name: string): void {
  console.log(`🔨 Building ${name}...`)
  
  try {
    // Use ncc CLI to build the action with timeout
    const command = `npx ncc build packages/${name}/src/main.ts --out packages/${name}/dist --source-map --license licenses.txt`
    console.log(`Running: ${command}`)
    execSync(command, { 
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout
      env: { ...process.env, NCC_BUILD: 'true' }
    })
    
    console.log(`✅ Built ${name} successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to build ${name}:`, errorMessage)
    process.exit(1)
  }
}

function buildSharedPackage(): void {
  console.log('🔨 Building shared package...')
  try {
    execSync('cd packages/shared && npx tsc', { stdio: 'inherit' })
    console.log('✅ Built shared package successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Failed to build shared package:', errorMessage)
    process.exit(1)
  }
}

function buildAll(): void {
  console.log('🚀 Building all GitHub Actions...')
  
  // Build shared package first
  buildSharedPackage()
  
  // Build all actions sequentially (since we're using execSync)
  packages.forEach(buildAction)
  
  console.log('🎉 All actions built successfully!')
}

// Run if this is the main module
if (require.main === module) {
  try {
    buildAll()
  } catch (error) {
    console.error('💥 Build failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

export { buildAll, buildAction, buildSharedPackage }