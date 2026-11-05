import { describe, expect, it } from "vitest";
import { ApiClient, ApiError } from "../src/services/apiClient";
import { createApiService } from "../src/services/apiService";
import type { LineupDraft } from "../src/domain/types";
const draft: LineupDraft = { title:"Teste", mapId:"mirage", type:"smoke", side:"T", instructions:"Instruções", target:{x:.5,y:.5}, media:{kind:"keep"} };
describe("concorrência", () => {
 it("envia a versão aberta, mostra conflito e não repete PATCH", async () => {
  const calls: unknown[]=[];
  const client = new ApiClient('/api/v1',async()=>"token",async (_url, options) => { calls.push(JSON.parse(options!.body as string)); return Response.json({error:{code:'GRENADE_VERSION_CONFLICT'}},{status:409}); });
  const service=createApiService(client,async()=>{throw new Error("não deve enviar mídia")});
  await expect(service.updateLineup('id',draft,{expectedRevision:7})).rejects.toMatchObject({code:'GRENADE_VERSION_CONFLICT',status:409});
  expect(calls).toHaveLength(1); expect(calls[0]).toMatchObject({expectedRevision:7,title:'Teste'}); expect(draft.media).toEqual({kind:'keep'});
 });
 it("recusa editar sem versão antes de qualquer requisição",async()=>{
  let calls=0; const client=new ApiClient('/api/v1',async()=>"token",async()=>{calls++;throw new Error('rede')});
  const service=createApiService(client,async()=>{throw new Error('upload')});
  await expect(service.updateLineup('id',draft)).rejects.toMatchObject({code:'REVISION_REQUIRED'} satisfies Partial<ApiError>); expect(calls).toBe(0);
 });
});
