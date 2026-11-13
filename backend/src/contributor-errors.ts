// Tradução ÚNICA das exceções de propriedade/cotas lançadas pelos triggers do banco (contribuidores). Usada pelas rotas
// comuns (`checked`) e pelo caminho das RPCs de importação (`importDbResult`), para o mesmo erro ter sempre o mesmo contrato.
// 429 = limite do próprio contribuidor (tente depois); 503 = orçamento global esgotado (capacidade do serviço).
const contributorErrors=[
 ['CONTRIBUTOR_QUOTA_EXCEEDED',429],
 ['CONTRIBUTOR_PENDING_LIMIT',429],
 ['CONTRIBUTOR_STORAGE_EXCEEDED',429],
 ['CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED',503],
 ['VIDEO_NOT_OWNED',403],
 ['IMMUTABLE_OWNERSHIP',403]
] as const;
export function contributorError(message?:string|null):{code:string;status:number}|undefined{
 if(!message)return undefined;
 for(const [code,status] of contributorErrors)if(message.includes(code))return {code,status};
 return undefined;
}
