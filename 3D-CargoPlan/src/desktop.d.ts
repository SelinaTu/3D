// #created 11/08/2026
export {}
declare global {
  interface Window {
    cargoPlanDesktop?: { onNavigate(callback: (workspace: 'bench' | 'demo' | 'ports' | 'value') => void): () => void }
  }
}
