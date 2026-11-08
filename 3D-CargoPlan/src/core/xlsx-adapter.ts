// #created 11/08/2026
import * as XLSXModule from 'xlsx'

// Node ESM exposes the CommonJS default; Vite exposes the namespace.
// A synchronous adapter keeps browser imports free of top-level await.
const XLSX = (XLSXModule as typeof XLSXModule & { default?: typeof XLSXModule }).default ?? XLSXModule
export default XLSX
