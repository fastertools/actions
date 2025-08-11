import { ChildProcess } from 'child_process'

export async function spawnAsync(command: string, args: string[]): Promise<ChildProcess> {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🚀 Stub spawn: ${command} ${args.join(' ')}`)
  return {} as ChildProcess
}

export function setupProcessCleanup(processes: ChildProcess[]): void {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🧹 Stub process cleanup for ${processes.length} processes`)
}