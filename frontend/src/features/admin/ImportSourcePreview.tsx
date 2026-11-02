import { useEffect, useRef, useState } from "react";
import type { LineupService } from "../../services/lineupService";
import type { ImportInspection } from "../../domain/imports";
import { formatTimecode } from "../../domain/timecode";
import { ApiError } from "../../services/apiClient";

export function ImportSourcePreview({ inspection, service, onMark, onExpired }: {
  inspection: ImportInspection;
  service: LineupService;
  onMark: (field: "startSeconds" | "endSeconds", seconds: number) => void;
  onExpired: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const pending = useRef<AbortController | null>(null);
  const resume = useRef<{time: number; playing: boolean; muted: boolean; volume: number} | null>(null);
  const [preview, setPreview] = useState<{url: string; expiresAt: string}>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  async function load(prepare: boolean) {
    if (!service.sourcePreview) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError(undefined);
    setLoading(true);
    try {
      const data = await service.sourcePreview(inspection.sourceId, inspection.expiresAt, prepare, controller.signal);
      if (controller.signal.aborted) return;
      if (!prepare && video.current) {
        const player = video.current;
        resume.current = { time: player.currentTime, playing: !player.paused, muted: player.muted, volume: player.volume };
      }
      setPreview({url: data.url, expiresAt: data.expiresAt});
    } catch (cause) {
      if (!controller.signal.aborted) {
        setPreview(undefined);
        if (cause instanceof ApiError && cause.code === "SOURCE_EXPIRED") { onExpired(); return; }
        setError("Não foi possível carregar a prévia. Você ainda pode escolher o trecho pelos horários ou enviar um MP4.");
      }
    } finally { if (pending.current === controller) setLoading(false); }
  }
  useEffect(() => {
    void load(true);
    return () => { pending.current?.abort(); };
  }, [inspection.sourceId, service]);
  useEffect(() => {
    if (!preview) return;
    const ms = Math.max(1000, Date.parse(preview.expiresAt) - Date.now() - 5000);
    const timer = setTimeout(() => { void load(false); }, ms);
    return () => clearTimeout(timer);
  }, [preview]);
  function mark(field: "startSeconds" | "endSeconds") {
    const seconds = video.current?.currentTime;
    if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0 || seconds > inspection.durationSeconds) return;
    onMark(field, Math.round(seconds * 1000) / 1000);
  }
  return <div className="import-source-preview">
    {!preview && <button type="button" className="button secondary" disabled={loading} onClick={() => void load(true)}>
      {loading ? "Carregando prévia…" : "Carregar prévia do vídeo"}
    </button>}
    {preview && <>
      <p className="field-hint">Prévia temporária: o trecho ainda não foi importado nem publicado.</p>
      <video ref={video} className="media-preview" src={preview.url} controls playsInline preload="metadata"
        aria-label="Prévia do vídeo de origem" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => {
          const state = resume.current;
          if (!state) return;
          resume.current = null;
          const player = event.currentTarget;
          player.currentTime = Math.min(state.time, Number.isFinite(player.duration) ? player.duration : state.time);
          player.muted = state.muted; player.volume = state.volume;
          if (state.playing) void player.play().catch(() => {});
        }} onError={() => { setPreview(undefined); setError("A prévia não está disponível. Carregue novamente ou escolha pelos horários."); }} />
      <p className="field-hint">Posição atual: <output aria-label="Posição atual do vídeo">{formatTimecode(currentTime)}</output></p>
      <div className="import-preview-actions">
        <button type="button" className="button secondary" onClick={() => mark("startSeconds")}>Usar posição como início</button>
        <button type="button" className="button secondary" onClick={() => mark("endSeconds")}>Usar posição como fim</button>
      </div>
      <p className="field-hint">A prévia é temporária. Use os controles para encontrar o momento de início e fim.</p>
    </>}
    {error && <p className="field-hint" role="status">{error}</p>}
  </div>;
}
