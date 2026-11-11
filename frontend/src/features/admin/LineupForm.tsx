import { useEffect, useRef, useState } from "react";
import type {
  GameMap,
  GrenadeType,
  SingleGrenadeType,
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
import { MutedVideo } from "../../components/MutedVideo";
import { hasLevels, levelFor, levelsOf, levelText } from "../../domain/mapLevels";
import type { MapLevelId } from "../../domain/mapLevels";
import { isTarget } from "../../domain/lineups";
import { PointCoordinates } from "./PointCoordinates";
import { importSelectionError } from "../../domain/imports";
import { localDraftKey, makeLocalDraft, parseLocalDraft } from "./localDraft";
import { recognizeVideoSource } from "../../domain/videoSource";

const importStages: Record<string, string> = {
  resolving: "Conferindo a fonte do vídeo…", downloading: "Importando o trecho selecionado…",
  transcoding: "Preparando o trecho para reprodução…", validating: "Validando o arquivo final…",
  storing: "Armazenando o vídeo do time…",
};

export function LineupForm({
  maps,
  accountId,
  existing,
  service,
  capabilities,
  onClose,
  onSaved,
}: {
  maps: GameMap[];
  accountId?: string;
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
          destinations: existing.destinations?.map((d) => { const level = levelFor(existing.mapId, d.level ?? existing.targetLevel); return level ? { ...d, level } : d; }) ?? existing.destinations,
          origin: existing.origin ?? null,
          // Cadastros anteriores aos andares (nível nulo) pertencem ao andar padrão do mapa.
          ...(hasLevels(existing.mapId) ? {
            originLevel: existing.origin ? levelFor(existing.mapId, existing.originLevel) : null,
            targetLevel: levelFor(existing.mapId, existing.targetLevel),
          } : {}),
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const storageKey = accountId ? localDraftKey(accountId, existing?.id) : null;
  const [loadedStorage] = useState(() => {
    try {
      const raw = storageKey && localStorage.getItem(storageKey);
      const value = raw ? parseLocalDraft(raw, maps.map(m => m.id)) : null;
      return { value, issue: raw && !value ? "O rascunho local está inválido e não pôde ser recuperado." : "" };
    } catch { return { value: null, issue: "Não foi possível acessar os rascunhos neste navegador." }; }
  });
  const [storageIssue, setStorageIssue] = useState(loadedStorage.issue);
  const [stored, setStored] = useState(loadedStorage.value);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const savedMedia = useRef<LineupDraft["media"] | null>(null);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [marking, setMarking] = useState<"origin" | "target" | "idle">("origin");
  const [originTouched, setOriginTouched] = useState(false);
  const [mapChanged, setMapChanged] = useState(false);
  const [viewLevel, setViewLevel] = useState<MapLevelId>();
  const [failure, setFailure] = useState<string>();
  const [fileReady, setFileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [resumeMediaId, setResumeMediaId] = useState<string>();
  const [testPlayback, setTestPlayback] = useState<string>();
  useEffect(() => { setTestPlayback(undefined); }, [draft.media]);
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
  const leveled = hasLevels(draft.mapId);
  const shownLevel = leveled ? levelFor(draft.mapId, viewLevel) : undefined;
  const soloMode = draft.type === "solo_exec";
  const activeDestination = soloMode ? draft.destinations?.[destinationIndex] : undefined;
  const activeTargetLevel = soloMode ? activeDestination?.level : draft.targetLevel;
  // O radar mostra o andar do ponto que está sendo marcado; clicar nele grava o ponto nesse andar.
  const showLevel = (value?: MapLevelId | null) => { if (leveled && value) setViewLevel(value); };
  const levelName = (value?: MapLevelId | null) => (value ? levelText(draft.mapId, value) : "andar não definido");
  function setOriginLevel(value: MapLevelId) {
    setOriginTouched(true);
    setDraft((current) => ({ ...current, originLevel: value }));
    setErrors((current) => ({ ...current, originLevel: "" }));
    setViewLevel(value);
  }
  function setTargetLevel(value: MapLevelId) {
    setDraft((current) => {
      if (current.type !== "solo_exec") return { ...current, targetLevel: value };
      const destinations = [...(current.destinations ?? [])];
      if (destinations[destinationIndex]) destinations[destinationIndex] = { ...destinations[destinationIndex], level: value };
      return { ...current, destinations, targetLevel: destinations[0]?.level ?? null };
    });
    setErrors((current) => ({ ...current, targetLevel: "", destinations: "" }));
    setViewLevel(value);
  }
  const snapshot = JSON.stringify(makeLocalDraft(draft, step, existing?.updatedAt ?? null, originTouched, mapChanged));
  const contentSnapshot = (value: string) => { const parsed = JSON.parse(value); delete parsed.step; return JSON.stringify(parsed); };
  function saveLocal() {
    if (!storageKey) { setStorageIssue("Conta não identificada. Não foi possível salvar neste navegador."); return; }
    try { localStorage.setItem(storageKey, snapshot); setSavedSnapshot(snapshot); savedMedia.current = draft.media; setStored(null); setStorageIssue(""); setNotice("Rascunho salvo neste navegador."); }
    catch { setStorageIssue("Não foi possível salvar neste navegador. Seus dados continuam nesta janela."); setNotice(""); }
  }
  function showErrors(next: Record<string, string>) {
    setErrors(next);
    if (["title", "mapId", "type", "side", "instructions"].some(key => next[key])) setStep(0);
    else if (["target", "origin", "destinations"].some(key => next[key])) setStep(1);
    else setStep(2);
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
      <nav className="editor-steps" aria-label="Etapas do editor">
        {["Informações", "Posicionamento", "Vídeo e revisão"].map((label, index) => <button key={label} type="button" disabled={busy} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index as 0 | 1 | 2)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      {stored && <section className="inline-notice">
        <h3>Rascunho encontrado</h3>
        <p>{existing && stored.baseUpdatedAt !== existing.updatedAt ? "A granada publicada mudou desde este rascunho. Para evitar sobrescrever alterações, descarte este rascunho e abra novamente a edição atual." : "Retome o progresso salvo neste navegador ou descarte o rascunho."}</p>
        <button type="button" className="button secondary" disabled={!!existing && stored.baseUpdatedAt !== existing.updatedAt} onClick={() => { setDraft(current => ({ ...current, ...stored.fields })); setStep(stored.step); setOriginTouched(stored.originTouched); setMapChanged(stored.mapChanged); setDestinationIndex(0); setMarking("idle"); setSavedSnapshot(JSON.stringify(stored)); savedMedia.current = draft.media; setStored(null); setNotice("Rascunho recuperado. Selecione o MP4 novamente ou faça uma nova consulta do link. O vídeo publicado é mantido na edição."); }}>Recuperar rascunho</button>{" "}
        <button type="button" className="text-button" onClick={() => { try { if (storageKey) localStorage.removeItem(storageKey); setStored(null); setNotice("Rascunho descartado."); } catch { setStorageIssue("Não foi possível descartar o rascunho neste navegador."); } }}>Descartar rascunho</button>
      </section>}
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (step !== 2 || submitLock.current) return;
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
          const sourcePlatform = draft.media.kind === "link" ? recognizeVideoSource(draft.media.sourceUrl)?.platform : undefined;
          const sourceCapability = sourcePlatform && sourcePlatform !== "youtube" ? capabilities.importers[sourcePlatform] : undefined;
          if (draft.media.kind === "link" && sourceCapability?.enabled && sourceCapability.inspection) {
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
            expectedRevision: existing?.revision,
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
            const { origin: _origin, originLevel: _originLevel, ...unchangedOrigin } = draft;
            const savingDraft = existing && !originTouched ? unchangedOrigin : draft;
            const item = existing
              ? await service.updateLineup(existing.id, savingDraft, options)
              : await service.createLineup(savingDraft, options);
            if (!controller.signal.aborted) {
              try { if (storageKey) localStorage.removeItem(storageKey); } catch { /* Publication succeeded even if local cleanup is unavailable. */ }
              onSaved(item);
            }
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
                "IMPORT_ACCESS_DENIED", "IMPORT_HTTP_ERROR", "IMPORT_NETWORK_LIMIT", "IMPORT_TIMEOUT", "IMPORT_FAILED", "SOURCE_CHANGED",
                "SOURCE_EXPIRED", "SOURCE_NOT_FOUND", "IMPORT_SELECTION_CONFLICT",
              ].includes(error.code)
            )
              setResumeMediaId(undefined);
            if (importFailed || error instanceof ApiError && ["IMPORT_ACCESS_DENIED", "IMPORT_HTTP_ERROR", "IMPORT_NETWORK_LIMIT", "IMPORT_TIMEOUT", "IMPORT_FAILED", "INVALID_MEDIA", "FILE_TOO_LARGE",
              "SOURCE_CHANGED", "SOURCE_EXPIRED", "SOURCE_NOT_FOUND", "IMPORT_SELECTION_CONFLICT", "MEDIA_SELECTION_CHANGED"].includes(error.code))
              setDraft(current => current.media.kind === "link" ? { ...current, media: { kind: "link", sourceUrl: current.media.sourceUrl, ...(current.media.reedit ? { reedit: current.media.reedit } : {}) } } : current);
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
        <fieldset disabled={busy} className="form-grid editor-panels">
          <div className="form-fields" hidden={step !== 0}>
            <h3>Informações da granada</h3><p className="field-hint">Identifique a jogada e descreva como executá-la.</p>
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
                      destinations: null,
                      origin: null,
                      // Só limpa os andares se o mapa anterior os tinha; nos demais mapas nada é enviado.
                      ...(current.originLevel || current.targetLevel ? { originLevel: null, targetLevel: null } : {}),
                    }));
                    setViewLevel(undefined);
                    setOriginTouched(true);
                    setMapChanged(true);
                    setDestinationIndex(0);
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
                  onChange={(event) => {
                    const type = event.target.value as GrenadeType;
                    setDestinationIndex(0);
                    setDraft(current => ({ ...current, type, destinations: type === "solo_exec" && current.target ? [{ ...current.target, type: "smoke" }] : null }));
                  }}
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
          </div>
          <div className="form-radar" hidden={step !== 1}>
            <h3 className="field-title">Origem e destino no radar</h3>
            <p className="field-hint">
              Marque onde o jogador lança e onde a granada cai. Ao trocar o mapa,
              os dois pontos são apagados e precisam ser marcados novamente.
            </p>
            <div className="point-modes" role="group" aria-label="Ponto a marcar">
              <button type="button" className="filter" aria-pressed={marking === "origin"}
                onClick={() => { setMarking("origin"); showLevel(draft.originLevel); }}>Marcar origem</button>
              <button type="button" className="filter" aria-pressed={marking === "target"}
                onClick={() => { setMarking("target"); showLevel(activeTargetLevel); }}>Marcar destino</button>
            </div>
            <p className="field-hint" role="status">
              {marking === "origin" ? "Clique no radar para marcar a posição de lançamento." : marking === "target" ? "Clique no radar para marcar onde a granada cai." : "Pontos marcados. Selecione um ponto para reposicioná-lo."}
            </p>
            {leveled && <div className="level-fields">
              <fieldset className="level-choice">
                <legend>Andar da origem</legend>
                {levelsOf(draft.mapId)!.levels.map((item) => <label key={item.id}>
                  <input type="radio" name="origin-level" value={item.id} checked={draft.originLevel === item.id}
                    onChange={() => setOriginLevel(item.id)} />
                  <span>{item.label} · {item.name}</span>
                </label>)}
              </fieldset>
              <fieldset className="level-choice">
                <legend>{soloMode ? `Andar do destino ${destinationIndex + 1}` : "Andar do destino"}</legend>
                {levelsOf(draft.mapId)!.levels.map((item) => <label key={item.id}>
                  <input type="radio" name="target-level" value={item.id} checked={activeTargetLevel === item.id}
                    disabled={soloMode && !activeDestination} onChange={() => setTargetLevel(item.id)} />
                  <span>{item.label} · {item.name}</span>
                </label>)}
              </fieldset>
              <p className="field-hint" role="status">
                Origem: {draft.origin ? levelName(draft.originLevel) : "não marcada"} · Destino: {draft.target ? levelName(activeTargetLevel) : "não marcado"}.
                {draft.origin && draft.target && draft.originLevel && activeTargetLevel && draft.originLevel !== activeTargetLevel ? " A granada muda de andar." : ""}
              </p>
              {(errors.originLevel || errors.targetLevel) && <p className="field-error">{errors.originLevel || errors.targetLevel}</p>}
            </div>}
            <Radar
              demo={demo}
              map={map}
              target={draft.type === "solo_exec" ? draft.destinations?.[destinationIndex] ?? draft.target : draft.target}
              extraTargets={draft.type === "solo_exec" ? draft.destinations : undefined}
              origin={draft.origin}
              level={shownLevel}
              onLevelChange={leveled ? setViewLevel : undefined}
              originLevel={draft.originLevel}
              targetLevel={draft.targetLevel}
              levelGroupLabel={marking === "origin" ? "Andar exibido (a origem será marcada neste andar)" : "Andar exibido (o destino será marcado neste andar)"}
              marking={marking}
              selectedTargetIndex={destinationIndex}
              onEditOrigin={() => { setMarking("origin"); showLevel(draft.originLevel); }}
              onEditTarget={(index) => { setDestinationIndex(index); setMarking("target"); showLevel(soloMode ? draft.destinations?.[index]?.level : draft.targetLevel); }}
              onOriginChange={(origin) => {
                update("origin", origin);
                if (leveled) setDraft((current) => ({ ...current, originLevel: shownLevel ?? null }));
                const destination = draft.type === "solo_exec" ? draft.destinations?.[destinationIndex] ?? draft.target : draft.target;
                setMarking(destination ? "idle" : "target");
              }}
              onTargetChange={(target) => {
                setMarking("idle");
                if (draft.type !== "solo_exec") { update("target", target); if (leveled) setDraft((current) => ({ ...current, targetLevel: shownLevel ?? null })); return; }
                const destinations = [...(draft.destinations ?? [])];
                destinations[destinationIndex] = { ...target, type: destinations[destinationIndex]?.type ?? "smoke", ...(leveled && shownLevel ? { level: shownLevel } : {}) };
                setDraft(current => ({ ...current, target: destinations[0] ? {x: destinations[0].x, y: destinations[0].y} : null, ...(leveled ? { targetLevel: destinations[0]?.level ?? null } : {}), destinations }));
              }}
            />
            <p className="field-hint">Círculo com +: origem. Círculo com mira: destino. Selecione um ponto para ajustar.</p>
            {existing && !draft.origin && <p className="legacy-origin">
              {existing.origin == null
                ? "Origem não cadastrada. Este cadastro antigo pode continuar sem origem; você também pode marcar a posição do jogador."
                : mapChanged ? "Marque uma origem para este mapa antes de salvar."
                : "Origem removida deste cadastro. Salve para confirmar a remoção."}
            </p>}
            {existing && draft.origin && <button type="button" className="text-button"
              onClick={() => update("origin", null)}>Remover origem</button>}
            <details className="editor-advanced"><summary>Ajustar coordenadas da origem</summary>
            <h4 className="point-heading">Origem do lançamento</h4>
            <PointCoordinates origin value={draft.origin ?? null} error={errors.origin}
              onChange={(origin) => { update("origin", origin); if (leveled && origin) setDraft((current) => ({ ...current, originLevel: current.originLevel ?? shownLevel ?? null })); }} />
            {errors.origin && <p className="field-error">{errors.origin}</p>}
            </details>
            {draft.type === "solo_exec" && <div className="solo-destinations">
              <h4>Granadas da execução</h4>
              {(draft.destinations ?? []).map((destination, index) => <div key={index}>
                <button type="button" aria-pressed={destinationIndex === index} onClick={() => { setDestinationIndex(index); setMarking("target"); showLevel(destination.level); }}>Destino {index + 1}</button>
                {leveled && <span className="destination-level">{levelName(destination.level)}</span>}
                <select aria-label={`Tipo do destino ${index + 1}`} value={destination.type} onChange={event => {
                  const destinations = [...(draft.destinations ?? [])]; destinations[index] = { ...destination, type: event.target.value as SingleGrenadeType }; update("destinations", destinations);
                }}><option value="smoke">Smoke</option><option value="flashbang">Flashbang</option><option value="molotov">Molotov</option><option value="he">HE Grenade</option></select>
                <button type="button" onClick={() => { const destinations = (draft.destinations ?? []).filter((_, i) => i !== index); setDestinationIndex(0); setDraft(current => ({ ...current, destinations, target: destinations[0] ? {x: destinations[0].x, y: destinations[0].y} : null })); }}>Remover</button>
              </div>)}
              <button type="button" disabled={!draft.target || (draft.destinations?.length ?? 0) >= 12} onClick={() => { const destinations = [...(draft.destinations ?? []), { ...draft.target!, type: "smoke" as const, ...(leveled && shownLevel ? { level: shownLevel } : {}) }]; setDestinationIndex(destinations.length - 1); setMarking("target"); update("destinations", destinations); }}>Adicionar destino</button>
              {errors.destinations && <p className="field-error">{errors.destinations}</p>}
            </div>}
            <details className="editor-advanced"><summary>Ajustar coordenadas do destino</summary>
            <h4 className="point-heading">Destino da granada</h4>
            <PointCoordinates value={draft.type === "solo_exec" ? draft.destinations?.[destinationIndex] ?? draft.target : draft.target} error={errors.target}
              onChange={(target) => { if (draft.type !== "solo_exec" || !target) { update("target", target); if (leveled && target) setDraft((current) => ({ ...current, targetLevel: current.targetLevel ?? shownLevel ?? null })); return; } const destinations = [...(draft.destinations ?? [])]; const level = leveled ? destinations[destinationIndex]?.level ?? shownLevel : undefined; destinations[destinationIndex] = { ...target, type: destinations[destinationIndex]?.type ?? "smoke", ...(level ? { level } : {}) }; setDraft(current => ({ ...current, target: destinations[0] ? {x: destinations[0].x, y: destinations[0].y} : null, ...(leveled ? { targetLevel: destinations[0]?.level ?? null } : {}), destinations })); }} />
            <p className="field-hint">
              Você também pode preencher as coordenadas pelo teclado. O ponto
              (0%, 0%) fica no canto superior esquerdo da imagem.
            </p>
            {errors.target && <p className="field-error">{errors.target}</p>}
            </details>
          </div>
          <div className="editor-media" hidden={step !== 2}>
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
            <section className="editor-review"><h3>Confira antes de salvar</h3>
              <dl><div><dt>Granada</dt><dd>{draft.title || "Título não preenchido"}</dd></div><div><dt>Mapa e tipo</dt><dd>{map.name} · {typeLabels[draft.type]} · {draft.side}</dd></div><div><dt>Posicionamento</dt><dd>{draft.origin ? "Origem marcada" : "Sem origem"} · {draft.target ? "Destino marcado" : "Sem destino"}{draft.type === "solo_exec" ? ` · ${draft.destinations?.length ?? 0} destinos` : ""}</dd></div><div><dt>Vídeo</dt><dd>{draft.media.kind === "keep" ? "Vídeo existente mantido" : draft.media.kind === "file" ? draft.media.file ? "MP4 selecionado; publicação após validação" : "Selecione um MP4" : "Link selecionado; consulte e revise o trecho"}</dd></div></dl>
              <p>{draft.instructions || "Instruções não preenchidas"}</p>
            </section>
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
        {draft.media.kind === "link" && service.testImport && <div className="import-test" hidden={step !== 2}>
          <button type="button" className="button secondary" disabled={busy || !draft.media.inspection || !draft.media.clip} onClick={async () => {
            if (submitLock.current) return;
            submitLock.current = true; setBusy(true); setFailure(undefined); setTestPlayback(undefined);
            const controller = new AbortController(); request.current = controller;
            try {
              const result = await service.testImport!(draft, { signal: controller.signal, mediaId: resumeMediaId, onProgress: value => {
                setProgress(value); if (value.mediaId) setResumeMediaId(value.mediaId);
              }});
              if (!controller.signal.aborted) { setResumeMediaId(result.mediaId); setTestPlayback(result.playback.url); }
            } catch (error) { if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : "Não foi possível testar a importação."); }
            finally { submitLock.current = false; setBusy(false); setProgress(undefined); request.current = null; }
          }}>Importar e testar em privado</button>
          <p className="field-hint">O teste armazena apenas o vídeo e não cadastra nem publica uma granada.</p>
          {testPlayback && <MutedVideo sourceKey={testPlayback} controls playsInline src={testPlayback} aria-label="Vídeo importado para teste privado" />}
        </div>}
        <div className="editor-draft-status" role="status"><p>{storageIssue || (savedSnapshot && (contentSnapshot(snapshot) !== contentSnapshot(savedSnapshot) || savedMedia.current !== draft.media) ? "Alterações pendentes desde o último rascunho." : notice || "Rascunho local: salve seu progresso em qualquer etapa.")}</p><p className="field-hint">O rascunho guarda os campos e pontos. Arquivos, links e sessões de vídeo não são salvos após fechar ou recarregar.</p></div>
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
          <button type="button" className="button secondary" disabled={busy} onClick={saveLocal}>Salvar rascunho</button>
          {step > 0 && <button type="button" className="button secondary" disabled={busy} onClick={() => setStep((step - 1) as 0 | 1 | 2)}>Voltar</button>}
          {step < 2 && <button type="button" className="button primary" disabled={busy} onClick={() => setStep((step + 1) as 0 | 1 | 2)}>Continuar</button>}
          <button type="submit" className="button primary" disabled={busy} hidden={step !== 2}>
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
