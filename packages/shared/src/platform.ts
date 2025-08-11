export interface Platform {
  os: 'linux' | 'darwin' | 'win32'
  arch: 'x64' | 'arm64'
  runner: string
}

export function detectPlatform(): Platform {
  // CRAWL Phase: Minimal stub implementation
  return { 
    os: 'linux', 
    arch: 'x64', 
    runner: 'ubuntu-latest' 
  }
}

export function getDownloadUrl(version: string, platform: Platform): string {
  // CRAWL Phase: Minimal stub implementation
  return `https://github.com/TBD54566975/ftl/releases/download/v${version}/ftl-${platform.os}-${platform.arch}.tar.gz`
}