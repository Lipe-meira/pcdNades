export function renewalDelay(
  expiresAt?: string,
  now = Date.now(),
): number | null {
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) return null;
  return Math.min(
    2_147_000_000,
    Math.max(1000, Date.parse(expiresAt) - now - 30_000),
  );
}

/** Estado de áudio de um player. Todo vídeo novo começa mutado, com volume máximo. */
export type AudioState = { muted: boolean; volume: number };
export const initialAudio: AudioState = { muted: true, volume: 1 };

export function captureAudio(player: { muted: boolean; volume: number }): AudioState {
  return { muted: player.muted, volume: player.volume };
}

export function restoreAudio(player: { muted: boolean; volume: number }, state: AudioState) {
  player.volume = state.volume;
  player.muted = state.muted;
}
