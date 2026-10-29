export type Clip = { startSeconds: number; endSeconds: number };
export type ClipLimits = {
  maxDurationSeconds: number;
  sourceDurationSeconds?: number;
  minDurationSeconds?: number;
  timePrecisionSeconds?: number;
};
export function validateClip(clip: Clip, limits: ClipLimits): string | null {
  const { startSeconds: start, endSeconds: end } = clip;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    return "Informe início e fim válidos, com o fim depois do início.";
  const precision = limits.timePrecisionSeconds ?? 0.001;
  if (
    [start, end].some(
      (value) =>
        Math.abs(value / precision - Math.round(value / precision)) > 1e-7,
    )
  )
    return "Use segundos com até três casas decimais, respeitando a precisão indicada.";
  const length = end - start;
  if (length + 1e-9 < (limits.minDurationSeconds ?? 0.1))
    return `Selecione pelo menos ${limits.minDurationSeconds ?? 0.1} segundo.`;
  if (length - 1e-9 > limits.maxDurationSeconds)
    return `O trecho deve ter no máximo ${limits.maxDurationSeconds} segundos.`;
  if (
    limits.sourceDurationSeconds !== undefined &&
    end > limits.sourceDurationSeconds + 1e-9
  )
    return "O fim do trecho ultrapassa a duração do vídeo de origem.";
  return null;
}
export function previewBounds(duration: number, clip?: Clip): Clip | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!clip) return { startSeconds: 0, endSeconds: duration };
  if (
    !Number.isFinite(clip.startSeconds) ||
    !Number.isFinite(clip.endSeconds) ||
    clip.startSeconds < 0 ||
    clip.endSeconds <= clip.startSeconds ||
    clip.endSeconds > duration
  )
    return null;
  return { ...clip };
}
export function clampPreviewTime(time: number, clip: Clip): number {
  return Math.min(clip.endSeconds, Math.max(clip.startSeconds, time));
}
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const hundredths = Math.round(seconds * 100);
  return `${String(Math.floor(hundredths / 6000)).padStart(2, "0")}:${((hundredths % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}
export function selectionDurationError(
  duration: number,
  clip: Clip | undefined,
  limits: {
    maxDurationSeconds: number;
    maxSourceDurationSeconds: number;
    minDurationSeconds?: number;
    timePrecisionSeconds?: number;
  },
): string | null {
  if (!Number.isFinite(duration) || duration <= 0)
    return "Aguarde a duração do vídeo carregar.";
  if (!clip)
    return duration <= limits.maxDurationSeconds
      ? null
      : `O vídeo inteiro deve ter até ${limits.maxDurationSeconds} segundos. Selecione um trecho quando o recorte estiver disponível.`;
  if (duration > limits.maxSourceDurationSeconds)
    return `A origem do recorte deve ter até ${limits.maxSourceDurationSeconds} segundos.`;
  return validateClip(clip, { ...limits, sourceDurationSeconds: duration });
}
export function sameClip(a?: Clip | null, b?: Clip | null): boolean {
  return (
    (a == null && b == null) ||
    (!!a &&
      !!b &&
      a.startSeconds === b.startSeconds &&
      a.endSeconds === b.endSeconds)
  );
}
