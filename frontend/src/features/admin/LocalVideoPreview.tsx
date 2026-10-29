import { useEffect, useRef, useState } from "react";
import { clampPreviewTime, previewBounds } from "../../domain/clip";
import type { Clip } from "../../domain/clip";

export function LocalVideoPreview({
  src,
  clip,
  duration,
  valid,
  onMetadata,
  onFailure,
}: {
  src: string;
  clip?: Clip;
  duration?: number;
  valid: boolean;
  onMetadata: (duration: number) => void;
  onFailure: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [playError, setPlayError] = useState(false);
  const bounds = duration ? previewBounds(duration, clip) : null;
  function clearStop() {
    if (stop.current) clearTimeout(stop.current);
    stop.current = undefined;
  }
  function scheduleStop() {
    clearStop();
    const element = video.current;
    if (!clip || !bounds || !element || element.paused) return;
    stop.current = setTimeout(
      () => {
        element.pause();
        element.currentTime = bounds.endSeconds;
      },
      Math.max(
        0,
        ((bounds.endSeconds - element.currentTime) /
          (element.playbackRate || 1)) *
          1000,
      ),
    );
  }
  useEffect(() => {
    clearStop();
    const element = video.current;
    if (clip && element) {
      element.pause();
      if (bounds) element.currentTime = bounds.startSeconds;
    }
    return clearStop;
  }, [src, clip?.startSeconds, clip?.endSeconds]);
  return (
    <>
      <video
        ref={video}
        className="media-preview"
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label="Prévia do MP4 selecionado"
        onLoadedMetadata={(event) => onMetadata(event.currentTarget.duration)}
        onError={onFailure}
        onPlay={(event) => {
          if (clip) {
            if (!valid || !bounds) {
              event.currentTarget.pause();
              return;
            }
            if (
              event.currentTarget.currentTime < bounds.startSeconds ||
              event.currentTarget.currentTime >= bounds.endSeconds
            )
              event.currentTarget.currentTime = bounds.startSeconds;
          }
          scheduleStop();
        }}
        onPause={clearStop}
        onRateChange={scheduleStop}
        onSeeked={scheduleStop}
        onTimeUpdate={(event) => {
          if (!clip || !bounds || !valid) return;
          const element = event.currentTarget;
          if (element.currentTime >= bounds.endSeconds) {
            element.pause();
            if (Math.abs(element.currentTime - bounds.endSeconds) > 0.0001)
              element.currentTime = bounds.endSeconds;
            clearStop();
          } else if (element.currentTime < bounds.startSeconds)
            element.currentTime = clampPreviewTime(element.currentTime, bounds);
        }}
      />
      {clip && (
        <button
          type="button"
          className="button secondary clip-play"
          disabled={!valid || !bounds}
          onClick={() => {
            const element = video.current;
            if (!element || !bounds) return;
            setPlayError(false);
            element.currentTime = bounds.startSeconds;
            void element.play().catch(() => setPlayError(true));
          }}
        >
          Reproduzir trecho
        </button>
      )}
      {playError && (
        <p role="alert" className="field-error">
          Não foi possível iniciar a prévia. Tente os controles do player.
        </p>
      )}
      <p className="field-hint">
        {clip
          ? "Prévia delimitada no original local. O arquivo ainda não foi cortado; o servidor executará o recorte quando habilitado."
          : "Prévia local do vídeo inteiro. Confirme o arquivo antes de enviar."}
      </p>
    </>
  );
}
