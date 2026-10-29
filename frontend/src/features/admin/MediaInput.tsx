import { useEffect, useRef, useState } from "react";
import type { MediaDraft, Video } from "../../domain/types";
import { validateDuration, validateMp4 } from "../../domain/validation";
import type { LineupService } from "../../services/lineupService";
import type { MediaCapabilities } from "../../services/apiContracts";
import { Icon } from "../../components/Icon";
import { VideoPlayer } from "../library/VideoPlayer";

export function MediaInput({
  value,
  existing,
  service,
  capabilities,
  onChange,
  onFileReady,
  error,
}: {
  value: MediaDraft;
  existing?: Video;
  service: LineupService;
  capabilities: MediaCapabilities;
  onChange: (value: MediaDraft) => void;
  onFileReady: (ready: boolean) => void;
  error?: string;
}) {
  const [fileError, setFileError] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [checking, setChecking] = useState(false);
  const sequence = useRef(0);
  const file = value.kind === "file" ? value.file : null;
  const demo = service.mode === "demo";
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  function changeMode(next: MediaDraft) {
    sequence.current++;
    setFileError(undefined);
    setChecking(false);
    onFileReady(false);
    onChange(next);
  }
  return (
    <div className="media-input">
      <div role="group" aria-label="Origem do vídeo" className="media-tabs">
        {existing && (
          <button
            type="button"
            className={`filter ${value.kind === "keep" ? "active" : ""}`}
            aria-pressed={value.kind === "keep"}
            onClick={() => changeMode({ kind: "keep" })}
          >
            Manter vídeo
          </button>
        )}
        <button
          type="button"
          className={`filter ${value.kind === "file" ? "active" : ""}`}
          aria-pressed={value.kind === "file"}
          onClick={() => changeMode({ kind: "file", file: null })}
        >
          <Icon name="upload" size={16} />
          Enviar MP4
        </button>
        <button
          type="button"
          className={`filter ${value.kind === "link" ? "active" : ""}`}
          aria-pressed={value.kind === "link"}
          onClick={() => changeMode({ kind: "link", sourceUrl: "" })}
        >
          <Icon name="link" size={16} />
          Importar por link
        </button>
      </div>
      {value.kind === "keep" && existing && (
        <>
          <VideoPlayer key={existing.id} video={existing} service={service} />
          <p className="field-hint">
            {demo
              ? "O vídeo atual será mantido. Arquivos locais só existem nesta sessão."
              : "O vídeo atual é mantido até a substituição ser processada e o cadastro salvo com sucesso."}
          </p>
        </>
      )}
      {value.kind === "file" && (
        <>
          {!capabilities.upload.enabled && (
            <p className="inline-notice" role="status">
              O servidor não está aceitando novos arquivos neste momento.
            </p>
          )}
          <label className="file-drop">
            Arquivo MP4
            <input
              type="file"
              accept="video/mp4,.mp4"
              disabled={!capabilities.upload.enabled}
              aria-describedby="file-hint"
              onChange={async (event) => {
                const nextFile = event.currentTarget.files?.[0] ?? null;
                const current = ++sequence.current;
                setFileError(undefined);
                onFileReady(false);
                onChange({ kind: "file", file: null });
                if (!nextFile) return;
                setChecking(true);
                try {
                  const message = await validateMp4(
                    nextFile,
                    capabilities.upload.maxBytes,
                  );
                  if (current !== sequence.current) return;
                  if (message) setFileError(message);
                  else onChange({ kind: "file", file: nextFile });
                } catch {
                  if (current === sequence.current)
                    setFileError(
                      "Não foi possível ler o arquivo. Selecione-o novamente.",
                    );
                } finally {
                  if (current === sequence.current) setChecking(false);
                }
              }}
            />
          </label>
          <p className="field-hint" id="file-hint">
            Até{" "}
            {(capabilities.upload.maxBytes / 1_000_000).toLocaleString("pt-BR")}{" "}
            MB e {capabilities.upload.maxDurationSeconds} segundos
            {demo
              ? " nesta demonstração. O arquivo será aberto localmente; nenhum upload ou armazenamento no servidor é feito."
              : ". O arquivo será enviado para validação antes da publicação."}
          </p>
          {checking && (
            <p role="status" className="field-hint">
              Verificando arquivo…
            </p>
          )}
          {preview && (
            <>
              <video
                className="media-preview"
                src={preview}
                controls
                playsInline
                preload="metadata"
                aria-label="Prévia do MP4 selecionado"
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  const valid = validateDuration(
                    duration,
                    capabilities.upload.maxDurationSeconds,
                  );
                  setFileError(
                    valid
                      ? undefined
                      : `Escolha um vídeo com duração de até ${capabilities.upload.maxDurationSeconds} segundos.`,
                  );
                  if (valid && file)
                    onChange({ kind: "file", file, durationSeconds: duration });
                  onFileReady(valid);
                }}
                onError={() => {
                  setFileError(
                    "Este navegador não conseguiu reproduzir o arquivo. Use MP4 com codecs compatíveis, como H.264/AAC.",
                  );
                  onFileReady(false);
                }}
              />
              <p className="field-hint">
                Prévia local · confirme o vídeo antes de enviar.
              </p>
            </>
          )}
        </>
      )}
      {value.kind === "link" && (
        <>
          <label>
            Link do YouTube Shorts ou TikTok
            <input
              type="url"
              value={value.sourceUrl}
              onChange={(event) =>
                onChange({ kind: "link", sourceUrl: event.target.value })
              }
              placeholder="https://www.youtube.com/shorts/…"
              aria-describedby="link-hint"
            />
          </label>
          <p className="inline-notice" id="link-hint">
            {!capabilities.importers.youtube.enabled &&
            !capabilities.importers.tiktok.enabled
              ? `Importação indisponível ${demo ? "nesta prévia" : "no servidor"}. O link não será baixado e a granada não será publicada. Escolha Enviar MP4 quando disponível.`
              : `Importadores: YouTube ${capabilities.importers.youtube.enabled ? "disponível" : "indisponível"}; TikTok ${capabilities.importers.tiktok.enabled ? "disponível" : "indisponível"}. A importação precisa concluir antes da publicação.`}
          </p>
        </>
      )}
      {(fileError || error) && (
        <p className="field-error" role="alert">
          {fileError || error}
        </p>
      )}
    </div>
  );
}
