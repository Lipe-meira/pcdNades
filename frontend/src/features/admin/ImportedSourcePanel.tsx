import { useState } from "react";
import type { Video } from "../../domain/types";
import type { MediaCapabilities } from "../../services/apiContracts";
import { importedSource, reeditDraft } from "../../domain/reedit";
import { formatTimecode } from "../../domain/timecode";
import type { MediaDraft } from "../../domain/types";

const platformLabel = { tiktok: "TikTok", instagram: "Instagram Reels" } as const;

/** Origem de um vídeo importado por link: URL, corte anterior e ação de reeditar. Nada aparece para MP4/legados. */
export function ImportedSourcePanel({ video, capabilities, onReedit }: {
  video: Video; capabilities: MediaCapabilities; onReedit: (draft: MediaDraft) => void;
}) {
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const source = importedSource(video);
  if (!source) return null;
  if (!source.available) return <div className="imported-source" role="status">
    <h4>Vídeo importado por link</h4>
    <p className="inline-notice">A URL original deste vídeo não foi registrada ou não é válida, então o corte não pode ser reeditado a partir dela. O vídeo atual continua intacto. Para trocar o vídeo, importe um novo link ou envie um MP4.</p>
  </div>;
  const importer = capabilities.importers[source.platform];
  const canReedit = importer?.enabled === true && importer.inspection === true;
  return <div className="imported-source">
    <h4>Vídeo importado por link · {platformLabel[source.platform]}</h4>
    <p className="imported-source-url">URL original: <code>{source.sourceUrl}</code></p>
    <div className="imported-source-actions">
      <button type="button" className="button secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(source.sourceUrl); setCopy("done"); } catch { setCopy("failed"); }
      }}>Copiar URL original</button>
      <a className="button secondary" href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir URL original</a>
    </div>
    {copy === "done" && <p className="field-hint" role="status">URL copiada.</p>}
    {copy === "failed" && <p className="field-error" role="alert">Não foi possível copiar automaticamente. Selecione a URL acima e copie manualmente.</p>}
    <p className="field-hint">{source.clip
      ? `Corte usado: ${formatTimecode(source.clip.startSeconds)} – ${formatTimecode(source.clip.endSeconds)} (${Number((source.clip.endSeconds - source.clip.startSeconds).toFixed(3))}s).`
      : "O intervalo do corte anterior não foi registrado para este vídeo."}</p>
    <button type="button" className="button secondary" disabled={!canReedit} onClick={() => onReedit(reeditDraft(source))}>Reeditar corte</button>
    <p className="field-hint">{canReedit
      ? "Consulta o vídeo original de novo para escolher outro intervalo. O vídeo atual só é substituído depois que o novo trecho for importado e validado; se a importação falhar, nada muda e o arquivo antigo não é apagado."
      : "A importação por link está indisponível no servidor agora. Tente mais tarde ou envie um MP4."}</p>
  </div>;
}
