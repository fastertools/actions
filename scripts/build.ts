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
    // Copy shared package files to local directory first
    copySharedToLocal(pkg.name)
    
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

function copySharedToLocal(packageName: string): void {
  const targetDir = `packages/${packageName}/src/shared`
  const sourceDir = 'packages/shared/src'
  
  console.log(`📦 Copying shared package to ${packageName}/src/shared/`)
  
  // Remove existing shared if it exists
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
  
  // Copy shared source files
  execSync(`cp -r "${sourceDir}" "${targetDir}"`)
  
  // Update imports in main.ts to use local shared files
  updateImportsToLocal(packageName)
}

function updateImportsToLocal(packageName: string): void {
  const mainTsPath = `packages/${packageName}/src/main.ts`
  
  if (fs.existsSync(mainTsPath)) {
    console.log(`🔄 Updating imports in ${packageName}/src/main.ts`)
    
    // Read the file content
    let content = fs.readFileSync(mainTsPath, 'utf8')
    
    // Replace @fastertools/shared imports with local ./shared imports
    content = content.replace(
      /from ['"]@fastertools\/shared['"]/g,
      "from './shared'"
    )
    
    // Write back the modified content
    fs.writeFileSync(mainTsPath, content)
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
  
  // Copy dist directory (excluding unnecessary files)
  const sourceDist = path.join(sourceDir, 'dist')
  const targetDist = path.join(targetDir, 'dist')
  
  if (fs.existsSync(sourceDist)) {
    // Remove existing dist if it exists
    if (fs.existsSync(targetDist)) {
      fs.rmSync(targetDist, { recursive: true, force: true })
    }
    
    // Create target dist directory
    fs.mkdirSync(targetDist, { recursive: true })
    
    // Copy only necessary files (exclude .ts files and shared directory)
    const files = fs.readdirSync(sourceDist)
    for (const file of files) {
      if (!file.endsWith('.ts') && file !== 'shared') {
        const sourcePath = path.join(sourceDist, file)
        const targetPath = path.join(targetDist, file)
        execSync(`cp "${sourcePath}" "${targetPath}"`)
      }
    }
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