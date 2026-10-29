import type { LineupDraft } from "./types";
import { isTarget } from "./lineups";
import { recognizeVideoSource } from "./videoSource";
import { validateClip } from "./clip";

// Demonstration guard only. Production limits and server validation are pending.
export const DEMO_MAX_BYTES = 50_000_000;
export const DEMO_MAX_SECONDS = 90;
export function validateDuration(
  duration: number,
  maxSeconds = DEMO_MAX_SECONDS,
): boolean {
  return Number.isFinite(duration) && duration > 0 && duration <= maxSeconds;
}

export function validateSourceUrl(value: string): string | null {
  return recognizeVideoSource(value)
    ? null
    : "Cole um link HTTPS de YouTube Shorts, TikTok ou Instagram Reels.";
}

export async function validateMp4(
  file: File,
  maxBytes = DEMO_MAX_BYTES,
): Promise<string | null> {
  if (!/\.mp4$/i.test(file.name) || (file.type && file.type !== "video/mp4"))
    return "Escolha um arquivo MP4.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > maxBytes)
    return `O limite é ${(maxBytes / 1_000_000).toLocaleString("pt-BR")} MB por arquivo.`;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp")
    return "O arquivo não tem uma assinatura de contêiner MP4 válida.";
  return null;
}

export function validateDraft(
  draft: LineupDraft,
  mapIds: string[],
  editing = false,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.title.trim() || draft.title.trim().length > 120)
    errors.title = "Informe um título de até 120 caracteres.";
  if (!mapIds.includes(draft.mapId))
    errors.mapId = "Selecione um mapa disponível.";
  if (!["smoke", "flashbang", "molotov"].includes(draft.type))
    errors.type = "Selecione um tipo válido.";
  if (!["T", "CT"].includes(draft.side)) errors.side = "Selecione T ou CT.";
  if (!draft.instructions.trim() || draft.instructions.length > 6000)
    errors.instructions = "Informe instruções de até 6.000 caracteres.";
  if (!draft.target || !isTarget(draft.target))
    errors.target =
      "Marque um destino no radar ou informe as coordenadas entre 0 e 100%.";
  if (draft.media.kind === "keep" && !editing)
    errors.media = "Selecione um arquivo MP4 ou informe um link.";
  if (draft.media.kind === "file" && !draft.media.file)
    errors.media = "Selecione um arquivo MP4.";
  if (draft.media.kind === "link") {
    const message = validateSourceUrl(draft.media.sourceUrl);
    if (message) errors.media = message;
  }
  if (draft.media.kind !== "keep" && draft.media.clip) {
    const message = validateClip(draft.media.clip, { maxDurationSeconds: 90 });
    if (message) errors.media = message;
  }
  return errors;
}
