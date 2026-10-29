import { useEffect, useRef, useState } from "react";
import type { MediaDraft, Video } from "../../domain/types";
import { validateMp4 } from "../../domain/validation";
import { selectionDurationError, validateClip } from "../../domain/clip";
import { recognizeVideoSource } from "../../domain/videoSource";
import type { LineupService } from "../../services/lineupService";
import { clipLimits } from "../../services/apiContracts";
import type { MediaCapabilities } from "../../services/apiContracts";
import { Icon } from "../../components/Icon";
import { VideoPlayer } from "../library/VideoPlayer";
import { ClipSelector } from "./ClipSelector";
import { LocalVideoPreview } from "./LocalVideoPreview";

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
  const [fileIssue, setFileIssue] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [playable, setPlayable] = useState(false);
  const sequence = useRef(0);
  const file = value.kind === "file" ? value.file : null;
  const demo = service.mode === "demo";
  const trim = capabilities.trimming;
  const duration = value.kind === "file" ? value.durationSeconds : undefined;
  const clip = value.kind !== "keep" ? value.clip : undefined;
  const source =
    value.kind === "link" ? recognizeVideoSource(value.sourceUrl) : null;
  const importer = source ? capabilities.importers[source.platform] : undefined;
  const selectionError =
    file && duration !== undefined
      ? clip && !trim?.enabled
        ? "O recorte está indisponível no servidor. Remova a seleção ou aguarde a liberação."
        : selectionDurationError(duration, clip, clipLimits(capabilities))
      : undefined;
  const byteLimit =
    clip && trim
      ? Math.min(trim.maxSourceBytes, capabilities.upload.maxBytes)
      : capabilities.upload.maxBytes;
  const bytesError =
    file && file.size > byteLimit
      ? "O arquivo excede o tamanho permitido para esta seleção."
      : undefined;
  const ready =
    playable &&
    !fileIssue &&
    !selectionError &&
    !bytesError &&
    !!file &&
    duration !== undefined;
  useEffect(() => {
    onFileReady(ready);
  }, [ready, onFileReady]);
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
    setFileIssue(undefined);
    setChecking(false);
    setPlayable(false);
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
              : "O vídeo atual será mantido até o novo arquivo ser validado e o cadastro salvo."}
          </p>
        </>
      )}
      {value.kind === "file" && (
        <>
          {capabilities.upload.processingMode === "inline-original" && (
            <p className="inline-notice">
              Envie o MP4 original com vídeo H.264 (yuv420p), áudio AAC ou sem
              áudio. Sem seleção, o original será validado sem conversão. Um
              trecho só será gerado se o recorte estiver habilitado.
            </p>
          )}
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
                const selected = event.currentTarget.files?.[0] ?? null;
                const current = ++sequence.current;
                setFileIssue(undefined);
                setPlayable(false);
                onFileReady(false);
                onChange({ kind: "file", file: null });
                if (!selected) return;
                setChecking(true);
                try {
                  const issue = await validateMp4(
                    selected,
                    trim?.enabled
                      ? Math.max(
                          capabilities.upload.maxBytes,
                          trim.maxSourceBytes,
                        )
                      : capabilities.upload.maxBytes,
                  );
                  if (current !== sequence.current) return;
                  if (issue) setFileIssue(issue);
                  else onChange({ kind: "file", file: selected });
                } catch {
                  if (current === sequence.current)
                    setFileIssue(
                      "Não foi possível ler o arquivo. Selecione-o novamente.",
                    );
                } finally {
                  if (current === sequence.current) setChecking(false);
                }
              }}
            />
          </label>
          <p className="field-hint" id="file-hint">
            Vídeo final: até {capabilities.upload.maxDurationSeconds}s e{" "}
            {(capabilities.upload.maxBytes / 1_000_000).toLocaleString("pt-BR")}{" "}
            MB.
            {trim?.enabled &&
              ` Com recorte, a origem pode ter até ${trim.maxSourceDurationSeconds}s e ${(trim.maxSourceBytes / 1_000_000).toLocaleString("pt-BR")} MB.`}
            {demo &&
              " Demonstração local: nenhum arquivo será enviado ao servidor."}
          </p>
          {checking && (
            <p role="status" className="field-hint">
              Verificando arquivo…
            </p>
          )}
          {preview && (
            <>
              <LocalVideoPreview
                src={preview}
                clip={clip}
                duration={duration}
                valid={ready}
                onMetadata={(seconds) => {
                  setPlayable(true);
                  setFileIssue(undefined);
                  if (
                    file &&
                    value.kind === "file" &&
                    value.durationSeconds !== seconds
                  )
                    onChange({ ...value, durationSeconds: seconds });
                }}
                onFailure={() => {
                  setPlayable(false);
                  setFileIssue(
                    "Não foi possível reproduzir este MP4. Exporte com codecs compatíveis, como H.264/AAC.",
                  );
                }}
              />
              <ClipSelector
                clip={clip}
                duration={duration}
                limits={trim}
                onChange={(selection) =>
                  onChange({ ...value, kind: "file", file, clip: selection })
                }
              />
            </>
          )}
        </>
      )}
      {value.kind === "link" && (
        <>
          <label>
            Link do YouTube Shorts, TikTok ou Instagram Reels
            <input
              type="url"
              value={value.sourceUrl}
              onChange={(event) =>
                onChange({ ...value, sourceUrl: event.target.value })
              }
              placeholder="Cole o link do vídeo"
            />
          </label>
          <div className="importer-status">
            {(["youtube", "tiktok", "instagram"] as const).map((platform) => {
              const available = capabilities.importers[platform];
              return (
                <p key={platform}>
                  <strong>
                    {platform === "youtube"
                      ? "YouTube Shorts"
                      : platform === "tiktok"
                        ? "TikTok"
                        : "Instagram Reels"}
                  </strong>{" "}
                  — {available?.enabled ? "Disponível" : "Indisponível"}
                  {!available?.enabled && (
                    <span>
                      {" "}
                      ·{" "}
                      {available?.message ||
                        "Integração ainda não habilitada. Use MP4 quando disponível."}
                    </span>
                  )}
                </p>
              );
            })}
          </div>
          {(!source || !importer?.enabled) && (
            <p className="inline-notice">
              {demo
                ? "Importação indisponível nesta prévia."
                : "Importação indisponível no servidor para a fonte selecionada."}{" "}
              Nenhum vídeo é baixado ou publicado nesta tela. Escolha Enviar MP4
              quando disponível.
            </p>
          )}
          <ClipSelector
            clip={clip}
            limits={trim}
            disabledReason={
              !importer?.enabled
                ? "Definição de trecho indisponível: a plataforma precisa estar habilitada no servidor."
                : undefined
            }
            onChange={(selection) => onChange({ ...value, clip: selection })}
          />
          <p className="field-hint">
            Não há prévia de vídeo para links. Quando habilitado, o servidor
            verifica a duração da origem e o trecho solicitado.
          </p>
          {clip &&
            importer?.enabled &&
            validateClip(clip, {
              ...clipLimits(capabilities),
              sourceDurationSeconds: trim?.maxSourceDurationSeconds,
            }) && (
              <p className="field-error" role="alert">
                Revise o intervalo solicitado.
              </p>
            )}
        </>
      )}
      {(fileIssue || selectionError || bytesError || error) && (
        <p className="field-error" role="alert">
          {fileIssue || selectionError || bytesError || error}
        </p>
      )}
    </div>
  );
}
