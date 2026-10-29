export type ImportProvider = 'youtube' | 'tiktok';
export interface ImportedFile { path: string; sourceUrl: string; provider: ImportProvider; }
export interface MediaImporter {
 readonly provider: ImportProvider;
 readonly enabled: boolean;
 // Implementations must enforce outbound URL restrictions and byte/time limits.
 download(sourceUrl: URL, signal: AbortSignal): Promise<ImportedFile>;
}
export class UnavailableImporter implements MediaImporter {
 readonly enabled = false;
 constructor(readonly provider: ImportProvider) {}
 async download(_sourceUrl: URL, _signal: AbortSignal): Promise<ImportedFile> {
  throw new Error('PLATFORM_UNSUPPORTED');
 }
}
export const importers: readonly MediaImporter[] = [new UnavailableImporter('youtube'), new UnavailableImporter('tiktok')];
