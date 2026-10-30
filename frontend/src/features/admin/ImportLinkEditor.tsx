import { useEffect, useRef, useState } from "react";
import type { MediaDraft } from "../../domain/types";
import type { LineupService } from "../../services/lineupService";
import type { MediaCapabilities } from "../../services/apiContracts";
import { recognizeVideoSource } from "../../domain/videoSource";
import { formatTimecode } from "../../domain/timecode";
import { ImportClipSelector } from "./ImportClipSelector";
import { ApiError } from "../../services/apiClient";

type Link = Extract<MediaDraft, { kind: "link" }>;
export function ImportLinkEditor({ value, service, capabilities, onChange }: {
  value: Link; service: LineupService; capabilities: MediaCapabilities; onChange: (value: Link) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string>();
  const [expired, setExpired] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const source = recognizeVideoSource(value.sourceUrl);
  const enabled = source?.platform === "tiktok" && capabilities.importers.tiktok.enabled &&
    capabilities.importers.tiktok.inspection === true && !!service.inspectImport;
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);
  useEffect(() => {
    if (!value.inspection) { setExpired(false); return; }
    const remaining = Date.parse(value.inspection.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [value.inspection]);
  return <div className="import-link-editor">
    <h4>1. Consulte o vídeo</h4>
    <label>Link do YouTube Shorts, TikTok ou Instagram Reels
      <input type="url" value={value.sourceUrl} placeholder="Cole o link do vídeo"
        onChange={(event) => {
          sequence.current++; request.current?.abort(); setBusy(false); setIssue(undefined);
          onChange({ kind: "link", sourceUrl: event.target.value });
        }} />
    </label>
    <div className="importer-status">
      {(["youtube", "tiktok", "instagram"] as const).map(platform => <p key={platform}>
        <strong>{platform === "youtube" ? "YouTube Shorts" : platform === "tiktok" ? "TikTok" : "Instagram Reels"}</strong>
        {" — "}{platform === "tiktok" && capabilities.importers.tiktok.enabled && capabilities.importers.tiktok.inspection
          ? "Disponível" : "Indisponível"}
        {!(platform === "tiktok" && capabilities.importers.tiktok.enabled && capabilities.importers.tiktok.inspection) &&
          <span> · {capabilities.importers[platform]?.message || "Integração ainda não habilitada. Use MP4 quando disponível."}</span>}
      </p>)}
    </div>
    {!enabled && <p className="inline-notice">{service.mode === "demo" ? "Importação indisponível nesta prévia." : "Importação indisponível no servidor para a fonte selecionada."} Nenhum vídeo é baixado ou publicado nesta tela. Escolha Enviar MP4 quando disponível.</p>}
    <button type="button" className="button secondary" disabled={!enabled || busy}
      onClick={async () => {
        const current = ++sequence.current;
        request.current?.abort();
        const controller = new AbortController(); request.current = controller;
        setIssue(undefined); setBusy(true);
        const url = value.sourceUrl.trim();
        onChange({ kind: "link", sourceUrl: value.sourceUrl });
        try {
          const inspection = await service.inspectImport!(url, controller.signal);
          if (controller.signal.aborted || current !== sequence.current) return;
          onChange({ kind: "link", sourceUrl: value.sourceUrl, inspectedUrl: url, inspection,
            clip: { startSeconds: 0, endSeconds: Math.min(inspection.durationSeconds, inspection.limits.maxDurationSeconds) } });
        } catch (error) {
          if (!controller.signal.aborted && current === sequence.current)
            setIssue(error instanceof ApiError && error.code === "PROCESSOR_BUSY"
              ? "Há outra importação em processamento. Aguarde e consulte o vídeo novamente."
              : error instanceof Error ? error.message : "Não foi possível consultar o vídeo.");
        } finally { if (current === sequence.current) setBusy(false); }
      }}>{value.inspection || issue ? "Consultar novamente" : "Consultar vídeo"}</button>
    {busy && <>
      <p className="field-hint" role="status">Consultando os dados do vídeo…</p>
      <button type="button" className="text-button" onClick={() => {
        sequence.current++; request.current?.abort(); setBusy(false); setIssue("Consulta cancelada. Os demais campos foram preservados.");
      }}>Cancelar consulta</button>
    </>}
    {issue && <p className="field-error" role="alert">{issue}</p>}
    {value.inspection && <>
      <div className="import-metadata">
        <strong>{value.inspection.title || "Vídeo do TikTok"}</strong>
        {value.inspection.author && <p>Autor: {value.inspection.author}</p>}
        <p>Duração da fonte: {formatTimecode(value.inspection.durationSeconds)}</p>
        <p className="field-hint">Fontes de até {formatTimecode(value.inspection.limits.maxSourceDurationSeconds)}. Só o trecho escolhido será solicitado para importação.</p>
      </div>
      <p className="inline-notice">Prévia visual indisponível para este link. Use a duração e os horários para selecionar o trecho. A consulta ainda não importou nem publicou o vídeo.</p>
      {expired && <p className="field-error" role="alert">A consulta expirou. Consulte novamente para iniciar outra importação. Uma importação já criada pode ser retomada.</p>}
      {value.clip && <ImportClipSelector key={value.inspection.sourceId} inspection={value.inspection}
        clip={value.clip} disabled={expired} onChange={(clip) => onChange({ ...value, clip })} />}
    </>}
  </div>;
}
