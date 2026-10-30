import { useEffect, useRef, useState } from "react";
import type {
  GameMap,
  GrenadeType,
  Lineup,
  LineupDraft,
  Side,
} from "../../domain/types";
import { typeLabels } from "../../domain/types";
import { validateDraft } from "../../domain/validation";
import type { LineupService } from "../../services/lineupService";
import { Dialog } from "../../components/Dialog";
import { Radar } from "../../components/Radar";
import { MediaInput } from "./MediaInput";
import type { MediaCapabilities, Progress } from "../../services/apiContracts";
import { ApiError } from "../../services/apiClient";
import { videoLabels } from "../../domain/types";
import { isTarget } from "../../domain/lineups";
import { PointCoordinates } from "./PointCoordinates";
import { importSelectionError } from "../../domain/imports";
import { recognizeVideoSource } from "../../domain/videoSource";

const importStages: Record<string, string> = {
  resolving: "Conferindo a fonte do vídeo…", downloading: "Importando o trecho selecionado…",
  transcoding: "Preparando o trecho para reprodução…", validating: "Validando o arquivo final…",
  storing: "Armazenando o vídeo do time…",
};

export function LineupForm({
  maps,
  existing,
  service,
  capabilities,
  onClose,
  onSaved,
}: {
  maps: GameMap[];
  existing?: Lineup;
  service: LineupService;
  capabilities: MediaCapabilities;
  onClose: () => void;
  onSaved: (item: Lineup) => void;
}) {
  const [draft, setDraft] = useState<LineupDraft>(() =>
    existing
      ? {
          title: existing.title,
          mapId: existing.mapId,
          type: existing.type,
          side: existing.side,
          instructions: existing.instructions,
          target: existing.target,
          origin: existing.origin ?? null,
          media: { kind: "keep" },
        }
      : {
          title: "",
          mapId: maps[0].id,
          type: "smoke",
          side: "T",
          instructions: "",
          target: null,
          origin: null,
          media: { kind: "file", file: null },
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [marking, setMarking] = useState<"origin" | "target">("origin");
  const [originTouched, setOriginTouched] = useState(false);
  const [mapChanged, setMapChanged] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [fileReady, setFileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [resumeMediaId, setResumeMediaId] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const demo = service.mode === "demo";
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  const submitLock = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const map = maps.find((item) => item.id === draft.mapId) ?? maps[0];
  function update<K extends keyof LineupDraft>(key: K, value: LineupDraft[K]) {
    if (key === "origin") setOriginTouched(true);
    if (key === "media") {
      setResumeMediaId(undefined);
      setProgress(undefined);
    }
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  return (
    <Dialog
      title={existing ? "Editar granada" : "Nova granada"}
      description={
        demo
          ? "Cadastro temporário para testar a interface. Nada será enviado ao servidor."
          : "O vídeo precisa estar pronto antes da publicação. O cadastro anterior é preservado até salvar."
      }
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitLock.current) return;
          const nextErrors = validateDraft(
            draft,
            maps.map((item) => item.id),
            !!existing,
          );
          if ((!existing || (mapChanged && existing.origin != null)) &&
              (!draft.origin || !isTarget(draft.origin)))
            nextErrors.origin = "Marque onde o jogador lança a granada ou preencha as coordenadas da origem.";
          if (draft.media.kind === "file" && draft.media.file && !fileReady)
            nextErrors.media =
              "Aguarde a prévia carregar e escolha um MP4 reproduzível.";
          if (draft.media.kind === "link" && recognizeVideoSource(draft.media.sourceUrl)?.platform === "tiktok" &&
            capabilities.importers.tiktok.enabled && capabilities.importers.tiktok.inspection) {
            const issue = importSelectionError(draft.media.inspection, draft.media.clip);
            if (issue) nextErrors.media = issue;
            else if (draft.media.inspectedUrl !== draft.media.sourceUrl.trim()) nextErrors.media = "O link mudou. Consulte o vídeo novamente.";
            else if (!resumeMediaId && Date.parse(draft.media.inspection!.expiresAt) <= Date.now())
              nextErrors.media = "A consulta expirou. Consulte o vídeo novamente.";
          }
          if (Object.keys(nextErrors).length) {
            showErrors(nextErrors);
            return;
          }
          submitLock.current = true;
          setBusy(true);
          setFailure(undefined);
          const controller = new AbortController();
          request.current = controller;
          let importFailed = false;
          const options = {
            signal: controller.signal,
            mediaId: resumeMediaId,
            onProgress: (value: Progress) => {
              if (draft.media.kind === "link" && value.status === "failed") importFailed = true;
              setProgress(value);
              if (
                value.mediaId &&
                ["confirming", "queued", "processing", "ready"].includes(
                  value.status,
                )
              )
                setResumeMediaId(value.mediaId);
              if (
                value.status === "failed" ||
                value.status === "awaiting_upload"
              )
                setResumeMediaId(undefined);
            },
          };
          try {
            // PATCH omission preserves the existing origin; null is an explicit removal.
            const { origin: _origin, ...unchangedOrigin } = draft;
            const savingDraft = existing && !originTouched ? unchangedOrigin : draft;
            const item = existing
              ? await service.updateLineup(existing.id, savingDraft, options)
              : await service.createLineup(savingDraft, options);
            if (!controller.signal.aborted) onSaved(item);
          } catch (error) {
            if (
              error instanceof ApiError &&
              [
                "UPLOAD_FAILED",
                "UPLOAD_INCOMPLETE",
                "UNSUPPORTED_CODEC",
                "INVALID_MEDIA",
                "DURATION_EXCEEDED",
                "FILE_TOO_LARGE",
                "PROCESSING_TIMEOUT",
                "MEDIA_SELECTION_CHANGED",
                "CLIP_INVALID",
                "CLIP_OUT_OF_RANGE",
                "CLIP_UNSUPPORTED",
                "IMPORT_NETWORK_LIMIT", "IMPORT_TIMEOUT", "IMPORT_FAILED", "SOURCE_CHANGED",
                "SOURCE_EXPIRED", "SOURCE_NOT_FOUND", "IMPORT_SELECTION_CONFLICT",
              ].includes(error.code)
            )
              setResumeMediaId(undefined);
            if (importFailed || error instanceof ApiError && ["IMPORT_NETWORK_LIMIT", "IMPORT_TIMEOUT", "IMPORT_FAILED", "INVALID_MEDIA", "FILE_TOO_LARGE",
              "SOURCE_CHANGED", "SOURCE_EXPIRED", "SOURCE_NOT_FOUND", "IMPORT_SELECTION_CONFLICT", "MEDIA_SELECTION_CHANGED"].includes(error.code))
              setDraft(current => current.media.kind === "link" ? { ...current, media: { kind: "link", sourceUrl: current.media.sourceUrl } } : current);
            setFailure(
              controller.signal.aborted
                ? "Acompanhamento pausado. O processamento pode continuar no servidor; use Salvar para retomar. Nenhuma publicação adicional será solicitada por esta janela."
                : error instanceof Error
                  ? error.message
                  : "Não foi possível salvar. Tente novamente.",
            );
            if (error instanceof ApiError && error.fields)
              setErrors(error.fields);
            requestAnimationFrame(() => errorRef.current?.focus());
          } finally {
            submitLock.current = false;
            setBusy(false);
          }
        }}
      >
        {(Object.values(errors).some(Boolean) || failure) && (
          <div
            className="error-summary"
            role="alert"
            tabIndex={-1}
            ref={errorRef}
          >
            <strong>{failure ?? "Revise os campos antes de salvar."}</strong>
            {!failure && (
              <ul>
                {Object.entries(errors)
                  .filter(([, message]) => message)
                  .map(([key, message]) => (
                    <li key={key}>{message}</li>
                  ))}
              </ul>
            )}
          </div>
        )}
        <fieldset disabled={busy} className="form-grid">
          <div className="form-fields">
            <label>
              Título
              <input
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                maxLength={120}
                aria-invalid={!!errors.title}
                autoComplete="off"
                placeholder="Ex.: nome da granada e destino"
              />
            </label>
            <div className="field-row">
              <label>
                Mapa
                <select
                  aria-label="Mapa"
                  value={draft.mapId}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      mapId: event.target.value,
                      target: null,
                      origin: null,
                    }));
                    setOriginTouched(true);
                    setMapChanged(true);
                    setMarking("origin");
                    setErrors((current) => ({ ...current, target: "", origin: "" }));
                  }}
                >
                  {maps.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  aria-label="Tipo"
                  value={draft.type}
                  onChange={(event) =>
                    update("type", event.target.value as GrenadeType)
                  }
                >
                  {Object.entries(typeLabels).map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lado
                <select
                  aria-label="Lado"
                  value={draft.side}
                  onChange={(event) =>
                    update("side", event.target.value as Side)
                  }
                >
                  <option>T</option>
                  <option>CT</option>
                </select>
              </label>
            </div>
            <label>
              Instruções
              <textarea
                rows={5}
                value={draft.instructions}
                onChange={(event) => update("instructions", event.target.value)}
                maxLength={6000}
                aria-invalid={!!errors.instructions}
                placeholder="Descreva posicionamento, mira e execução."
              />
            </label>
            <div>
              <h3 className="field-title">Vídeo</h3>
              <MediaInput
                service={service}
                capabilities={capabilities}
                value={draft.media}
                existing={existing?.video}
                onChange={(media) => update("media", media)}
                onFileReady={setFileReady}
                error={errors.media}
              />
            </div>
          </div>
          <div className="form-radar">
            <h3 className="field-title">Origem e destino no radar</h3>
            <p className="field-hint">
              Marque onde o jogador lança e onde a granada cai. Ao trocar o mapa,
              os dois pontos são apagados e precisam ser marcados novamente.
            </p>
            <div className="point-modes" role="group" aria-label="Ponto a marcar">
              <button type="button" className="filter" aria-pressed={marking === "origin"}
                onClick={() => setMarking("origin")}>Marcar origem</button>
              <button type="button" className="filter" aria-pressed={marking === "target"}
                onClick={() => setMarking("target")}>Marcar destino</button>
            </div>
            <p className="field-hint" role="status">
              {marking === "origin" ? "Marcando origem: posição do jogador." : "Marcando destino: onde a granada cai."}
            </p>
            <Radar
              demo={demo}
              map={map}
              target={draft.target}
              origin={draft.origin}
              marking={marking}
              onOriginChange={(origin) => update("origin", origin)}
              onTargetChange={(target) => update("target", target)}
            />
            <p className="field-hint">Quadrado azul: origem. Mira em areia: destino.</p>
            {existing && !draft.origin && <p className="legacy-origin">
              {existing.origin == null
                ? "Origem não cadastrada. Este cadastro antigo pode continuar sem origem; você também pode marcar a posição do jogador."
                : mapChanged ? "Marque uma origem para este mapa antes de salvar."
                : "Origem removida deste cadastro. Salve para confirmar a remoção."}
            </p>}
            {existing && draft.origin && <button type="button" className="text-button"
              onClick={() => update("origin", null)}>Remover origem</button>}
            <h4 className="point-heading">Origem do lançamento</h4>
            <PointCoordinates origin value={draft.origin ?? null} error={errors.origin}
              onChange={(origin) => update("origin", origin)} />
            {errors.origin && <p className="field-error">{errors.origin}</p>}
            <h4 className="point-heading">Destino da granada</h4>
            <PointCoordinates value={draft.target} error={errors.target}
              onChange={(target) => update("target", target)} />
            <p className="field-hint">
              Você também pode preencher as coordenadas pelo teclado. O ponto
              (0%, 0%) fica no canto superior esquerdo da imagem.
            </p>
            {errors.target && <p className="field-error">{errors.target}</p>}
          </div>
        </fieldset>
        {busy && !demo && (
          <div className="media-progress" role="status">
            <strong>
              {progress
                ? progress.status === "publishing"
                  ? "Publicando granada…"
                  : progress.status === "confirming"
                    ? "Confirmando envio…"
                    : videoLabels[progress.status]
                : "Preparando envio…"}
            </strong>
            <p>
              {draft.media.kind === "link" && progress?.status !== "publishing"
                ? importStages[progress?.stage ?? ""] ?? "Preparando a importação do trecho. Seu cadastro anterior será preservado até salvar."
                : progress?.status === "queued"
                ? "O vídeo está na fila. Aguarde o processamento."
                : progress?.status === "processing"
                  ? capabilities.upload.processingMode === "inline-original"
                    ? "O servidor está validando o MP4 original, sem conversão automática."
                    : "O servidor está validando e preparando o vídeo."
                  : progress?.status === "confirming"
                    ? "Aguardando a confirmação do servidor. A validação pode levar até dois minutos; o arquivo já foi enviado."
                    : progress?.status === "uploading"
                      ? "Enviando o arquivo. Mantenha esta janela aberta."
                      : "A granada só será publicada depois que o vídeo estiver pronto."}
            </p>
            {(progress?.status === "queued" ||
              progress?.status === "processing" || (draft.media.kind === "link" && progress?.status === "confirming")) && (
              <button
                type="button"
                className="text-button"
                onClick={() => request.current?.abort()}
              >
                Parar acompanhamento
              </button>
            )}
          </div>
        )}
        {!busy && resumeMediaId && (
          <p className="field-hint">
            {draft.media.kind === "link"
              ? "A importação já foi criada. Salvar novamente retoma o mesmo trecho, sem criar outra sessão."
              : "O arquivo já foi enviado. Salvar novamente retoma a confirmação ou o acompanhamento, sem reenviar o vídeo."}
          </p>
        )}
        <div className="form-actions">
          <span>
            {demo
              ? "Somente nesta sessão do navegador"
              : "Biblioteca compartilhada do time"}
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy
              ? "Salvando…"
              : draft.media.kind === "link"
                ? resumeMediaId ? "Retomar importação" : draft.media.inspection ? "Importar trecho e salvar granada" : "Verificar importação"
                : demo
                  ? "Salvar demonstração"
                  : "Salvar granada"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
