// #created 11/08/2026
import { createRoot } from 'react-dom/client'
import { KnowledgeGlobe } from '../KnowledgeGlobe'
import { FloatingAssistant } from '../../../support/SupportAssistant'
createRoot(document.getElementById('root')!).render(<><KnowledgeGlobe standalone /><FloatingAssistant workspace="ports" /></>)
