// #created 11/08/2026
export type PackingProgress = {processed: number; total: number; containers: number; placed: number; unpacked: number}
export type PackingProgressCallback = (progress: PackingProgress) => void
