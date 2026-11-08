// #created 11/08/2026
export type EvidenceHit={source_id:string;source_title?:string;page?:number|null;url?:string;knowledge_layer_label?:string;scope_note_zh?:string;review_status?:string;source_role?:string;snippet?:string}
export type EvidenceResponse={results:EvidenceHit[];notes_zh:string[];resolved_port_id:string|null}
export async function searchEvidence(query:string):Promise<EvidenceResponse>{
  const response=await fetch(`/api/knowledge/search?${new URLSearchParams({q:query})}`,{signal:AbortSignal.timeout(35000)})
  if(!response.ok)throw new Error('本地原文知识库暂不可用；请确认知识库及项目后端已启动。')
  return response.json() as Promise<EvidenceResponse>
}
