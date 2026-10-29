import { useEffect, useRef, useState } from "react";
import type { Video } from "../../domain/types";
import { videoLabels } from "../../domain/types";
import { renewalDelay } from "../../domain/playback";
import type { LineupService } from "../../services/lineupService";
import type { Playback } from "../../services/apiContracts";
import { Icon } from "../../components/Icon";

export function VideoPlayer({
  video,
  service,
}: {
  video: Video;
  service?: LineupService;
}) {
  const [lease, setLease] = useState<Playback>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const element = useRef<HTMLVideoElement>(null);
  const resume = useRef({ time: 0, playing: false });
  useEffect(() => {
    if (video.status !== "ready") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError(undefined);
    setLoading(true);
    async function load() {
      try {
        if (element.current)
          resume.current = {
            time: element.current.currentTime,
            playing: !element.current.paused,
          };
        const result = service
          ? await service.playback(video, controller.signal)
          : video.playbackUrl
            ? { url: video.playbackUrl, mimeType: "video/mp4" }
            : null;
        if (!result)
          throw new Error("O endereço do vídeo não está disponível.");
        if (controller.signal.aborted) return;
        setLease(result);
        setLoading(false);
        setError(undefined);
        const delay = renewalDelay(result.expiresAt);
        if (delay !== null) timer = setTimeout(load, delay);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir o vídeo.",
          );
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [video.id, video.status, video.playbackUrl, service, attempt]);
  if (video.status === "ready") {
    if (error)
      return (
        <div className="video-placeholder has-error" role="alert">
          <Icon name="video" size={28} />
          <strong>Vídeo indisponível</strong>
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Tentar reproduzir novamente
          </button>
        </div>
      );
    if (loading || !lease)
      return (
        <div className="video-placeholder" role="status">
          Abrindo vídeo…
        </div>
      );
    return (
      <video
        ref={element}
        className="video-player"
        src={lease.url}
        controls
        playsInline
        preload="metadata"
        aria-label="Vídeo da granada"
        onLoadedMetadata={(event) => {
          if (
            resume.current.time &&
            Number.isFinite(event.currentTarget.duration)
          )
            event.currentTarget.currentTime = Math.min(
              resume.current.time,
              event.currentTarget.duration,
            );
          if (resume.current.playing)
            void event.currentTarget.play().catch(() => {});
        }}
        onError={() => {
          if (element.current)
            resume.current = {
              time: element.current.currentTime,
              playing: !element.current.paused,
            };
          setError(
            "Não foi possível reproduzir o arquivo. Solicite um novo endereço ou tente outro navegador.",
          );
        }}
      >
        Seu navegador não suporta a reprodução deste vídeo.
      </video>
    );
  }
  return (
    <div
      className={`video-placeholder ${video.status === "failed" ? "has-error" : ""}`}
      role="status"
    >
      <Icon name="video" size={30} />
      <strong>
        {video.status === "missing"
          ? "Sem vídeo de demonstração"
          : videoLabels[video.status]}
      </strong>
      <p>
        {video.error ||
          (video.status === "missing"
            ? "O time poderá adicionar o vídeo de execução aqui."
            : "O vídeo só estará disponível depois da validação e do armazenamento.")}
      </p>
    </div>
  );
}
