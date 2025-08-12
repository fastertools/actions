import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const packages = [
  { name: 'setup-ftl', topLevelDir: 'setup-ftl-js' },
  { name: 'ftl-server-up', topLevelDir: 'ftl-server-up' },
  { name: 'ftl-eng-deploy', topLevelDir: 'ftl-eng-deploy' },
  { name: 'authenticate-ftl', topLevelDir: 'authenticate-ftl' }
]

function buildAction(pkg: { name: string, topLevelDir: string }): void {
  console.log(`🔨 Building ${pkg.name}...`)
  
  try {
    // Use ncc CLI to build the action with timeout
    const command = `npx ncc build packages/${pkg.name}/src/main.ts --out packages/${pkg.name}/dist --source-map --license licenses.txt`
    console.log(`Running: ${command}`)
    execSync(command, { 
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout
      env: { ...process.env, NCC_BUILD: 'true' }
    })
    
    // Copy built files to top-level action directory
    copyActionToTopLevel(pkg)
    
    console.log(`✅ Built ${pkg.name} successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to build ${pkg.name}:`, errorMessage)
    process.exit(1)
  }
}

function copyActionToTopLevel(pkg: { name: string, topLevelDir: string }): void {
  const sourceDir = `packages/${pkg.name}`
  const targetDir = pkg.topLevelDir
  
  console.log(`📦 Copying ${pkg.name} to ${targetDir}/`)
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  
  // Copy dist directory
  const sourceDist = path.join(sourceDir, 'dist')
  const targetDist = path.join(targetDir, 'dist')
  
  if (fs.existsSync(sourceDist)) {
    // Remove existing dist if it exists
    if (fs.existsSync(targetDist)) {
      fs.rmSync(targetDist, { recursive: true, force: true })
    }
    // Copy dist directory
    execSync(`cp -r "${sourceDist}" "${targetDist}"`)
  }
  
  // Copy action.yml
  const sourceActionYml = path.join(sourceDir, 'action.yml')
  const targetActionYml = path.join(targetDir, 'action.yml')
  
  if (fs.existsSync(sourceActionYml)) {
    execSync(`cp "${sourceActionYml}" "${targetActionYml}"`)
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