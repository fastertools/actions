To set up a repository for your GitHub Actions, create a single public repository to house all your actions, often called a "monorepo." This simplifies management and discoverability.

Repository Structure
The best practice is to place each action in its own directory within a parent actions folder. This keeps everything organized as you add more actions later.

Your repository structure should look like this:

.
├── .github/
│   └── workflows/
│       └── release.yml   # Workflow to test & release your actions
├── actions/
│   └── setup-ftl/        # Your first action
│       ├── src/
│       │   └── main.ts
│       ├── action.yml
│       ├── package.json
│       └── README.md
│   └── another-action/   # A future action
│       └── ...
└── README.md             # Top-level README for the whole collection
Versioning and Releases
Use a unified versioning strategy for discoverability and maintenance.

Tagging: When you release setup-ftl version 1.0.0, create a Git tag named setup-ftl/v1.0.0. Using a prefix (action-name/) prevents tag name collisions if you have multiple actions.

Major Version Tag: Also create and move a major version tag like setup-ftl/v1. Users will point to this tag (your-org/your-repo/actions/setup-ftl@v1) to automatically get non-breaking updates.

Automation: Create a CI/CD workflow (release.yml) that automates testing, bundling, and tagging your actions whenever you push changes to your main branch.

Usage in Workflows
Users will reference your actions using the path within your repository. This structure makes the reference clear and intuitive.

YAML

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 'Set up FTL CLI'
        uses: your-org/your-actions-repo/actions/setup-ftl@v1
        with:
          version: 'latest'
Documentation
Your repository's main README.md should serve as a portal, listing all the available actions with brief descriptions and links to their individual README.md files. Each action's own README.md must contain detailed usage instructions, input descriptions, and examples.


Putting It All Together: A Refactored Example
Here’s what your project could look like after formalizing it.

1. The New action.yml (Clean and Simple)
Notice how all the complex logic is gone. It just defines the interface and runs the code.

YAML

# action.yml
name: 'Setup FTL CLI'
description: 'Downloads, caches, and sets up the FTL CLI and its dependencies.'
author: 'FasterTools'
branding:
  icon: 'cloud'
  color: 'blue'

inputs:
  version:
    description: 'The version of the FTL CLI to install (e.g., "0.1.0" or "latest").'
    required: false
    default: 'latest'
  # We can likely combine the two booleans for a simpler UX
  install-dependencies:
    description: 'If true, also installs dependencies like Spin.'
    required: false
    default: 'true'

outputs:
  ftl-version:
    description: 'The resolved version of the installed FTL CLI.'
    value: ${{ steps.setup.outputs.ftl-version }}

runs:
  using: 'node20'
  main: 'dist/index.js' # This is the compiled TypeScript file
2. The TypeScript Code (src/main.ts)
This is a sketch of what your main logic file would look like. It uses the official Actions libraries to do the heavy lifting.

TypeScript

// src/main.ts
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as github from '@actions/github';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
    // --- Get Inputs ---
    const versionInput = core.getInput('version') || 'latest';
    const installDeps = core.getBooleanInput('install-dependencies');

    // --- Install FTL CLI ---
    core.startGroup('📥 Install FTL CLI');
    const ftlVersion = await getFTL(versionInput);
    core.setOutput('ftl-version', ftlVersion);
    core.endGroup();

    // --- Install Dependencies ---
    if (installDeps) {
      core.startGroup('🛠️ Install Dependencies');
      // Use other setup actions or your own logic here
      // Example: We can call other actions programmatically or shell out
      await exec.exec('npm', ['install', 'fermyon/actions/spin/setup']); // simplified example
      await exec.exec('spin', ['--version']);
      core.endGroup();
    }
    
    // --- Final Summary ---
    core.summary
      .addHeading('📋 FTL CLI Installation Summary')
      .addRaw(`✅ **FTL CLI Version**: ${ftlVersion}`)
      .addRaw(`✅ **Dependencies Installed**: ${installDeps}`)
      .write();

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

/**
 * Downloads and caches the FTL CLI
 * @param version The version to install (e.g., "0.1.0" or "latest")
 * @returns The resolved version string
 */
async function getFTL(version: string): Promise<string> {
  let resolvedVersion = version;

  // 1. Resolve 'latest' to a specific version number using the GitHub API
  if (version === 'latest') {
    const octokit = github.getOctokit(core.getInput('github-token')); // or use unauthenticated
    const { data: release } = await octokit.rest.repos.getLatestRelease({
      owner: 'fastertools',
      repo: 'ftl-cli',
    });
    resolvedVersion = release.tag_name.replace('cli-v', '');
    core.info(`'latest' resolved to version ${resolvedVersion}`);
  }

  // 2. Check the tool cache for a cached version
  let ftlPath = tc.find('ftl', resolvedVersion);

  if (!ftlPath) {
    core.info(`FTL CLI ${resolvedVersion} not found in cache. Downloading...`);
    // 3. Download if not cached
    const downloadUrl = `https://github.com/fastertools/ftl-cli/releases/download/cli-v${resolvedVersion}/ftl-${getPlatform()}`;
    const downloadPath = await tc.downloadTool(downloadUrl);
    
    // 4. Cache the downloaded tool
    const cachedPath = await tc.cacheFile(downloadPath, 'ftl', 'ftl', resolvedVersion);
    ftlPath = cachedPath;
  } else {
    core.info(`Found FTL CLI ${resolvedVersion} in cache!`);
  }

  // 5. Add the tool to the PATH for subsequent steps
  core.addPath(ftlPath);
  core.info('✅ FTL CLI has been added to the PATH.');

  // Verify the installation
  await exec.exec('ftl', ['--version']);

  return resolvedVersion;
}

function getPlatform(): string {
  // Simple platform detection logic
  if (process.platform === 'linux') return 'x86_64-unknown-linux-gnu';
  if (process.platform === 'darwin' && process.arch === 'x64') return 'x86_64-apple-darwin';
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'aarch64-apple-darwin';
  throw new Error('Unsupported platform');
}

run();
Next Steps to Formalize
Initialize a Node.js project: Run npm init in your action's repository.

Add dependencies: npm install @actions/core @actions/github @actions/tool-cache @actions/exec typescript. Also add @vercel/ncc as a dev dependency for bundling.

Create the src/main.ts file with the logic above.

Add a build script to your package.json like "build": "ncc build src/main.ts -o dist --source-map --license licenses.txt".

Update your action.yml to the simplified version that points to dist/index.js.

Implement the versioning strategy: When you release, tag it with $v1.0.0$ and also update the $v1$ tag to point to it.

This path will result in a much more professional, maintainable, and efficient action that follows the established conventions of the GitHub Actions ecosystem.