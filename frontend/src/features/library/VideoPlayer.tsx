import type { Video } from "../../domain/types";
import { videoLabels } from "../../domain/types";
import { Icon } from "../../components/Icon";

export function VideoPlayer({ video }: { video: Video }) {
  if (video.status === "ready" && video.playbackUrl)
    return (
      <video
        className="video-player"
        key={video.playbackUrl}
        src={video.playbackUrl}
        controls
        playsInline
        preload="metadata"
        aria-label="Vídeo da granada"
      >
        Seu navegador não suporta a reprodução deste vídeo.
      </video>
    );
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
            : video.status === "ready"
              ? "O endereço do vídeo ainda não está disponível."
              : "O vídeo só estará disponível depois da validação e do armazenamento.")}
      </p>
    </div>
  );
}
