// #created 11/08/2026
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative } from 'node:path'
import { performance } from 'node:perf_hooks'
import { researchFileHash } from '../core/research-calibration'
import { researchHash } from '../core/research-metrics'

/** Capture the executable revision, not just the input data revision. */
export function startReplayRecord(moduleUrl: string) {
  const startedAt = new Date().toISOString(), monotonicStart = performance.now(), wallStart = Date.now(), cpuStart = process.cpuUsage()
  const entryPoint = relative(process.cwd(), fileURLToPath(moduleUrl))
  const paths = [entryPoint, 'src/scripts/replay-run-record.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts', 'src/core/solution-builder.ts', 'src/core/greedy-algorithm.ts', 'src/core/research-calibration.ts', 'src/core/research-metrics.ts']
  const engineFiles = paths.map(path => ({ path, sha256: researchFileHash(path) }))
  return () => ({
    startedAt, finishedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - monotonicStart), wallClockElapsedMs: Date.now() - wallStart,
    cpuMicroseconds: process.cpuUsage(cpuStart), command: [process.execPath, ...process.execArgv, ...process.argv.slice(1)], nodeVersion: process.version,
    randomSeed: null, mode: 'deterministic-analytic-construction', engineFiles, engineSha256: researchHash(engineFiles),
    sourceSnapshotStable: engineFiles.every(file => existsSync(file.path) && researchFileHash(file.path) === file.sha256),
    logFormat: 'Every attempted insertion is recorded with source unit ID, XYZ, orientation, acceptance and concrete rejection reasons.'
  })
}

export function readPreviousReplayResult(path: string) {
  if (!existsSync(path)) return null
  const previous = JSON.parse(readFileSync(path, 'utf8'))
  return { sha256: researchFileHash(path), complete: previous.complete === true, loaded: previous.solution?.containers?.reduce((n: number, c: { items: unknown[] }) => n + c.items.length, 0), unpacked: previous.solution?.unpackedItems?.length }
}
