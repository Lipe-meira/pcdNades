import { useRef, useState } from "react";
import type { GameMap, Lineup } from "../../domain/types";
import { typeLabels, videoLabels } from "../../domain/types";
import type { LineupService } from "../../services/lineupService";
import { Icon } from "../../components/Icon";
import { Dialog } from "../../components/Dialog";
import { LineupForm } from "./LineupForm";

export function Admin({
  maps,
  lineups,
  service,
  onSaved,
  onDeleted,
}: {
  maps: GameMap[];
  lineups: Lineup[];
  service: LineupService;
  onSaved: (item: Lineup) => void;
  onDeleted: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [editing, setEditing] = useState<Lineup | "new" | null>(null);
  const [removing, setRemoving] = useState<Lineup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [mapId, setMapId] = useState("all");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const visible = lineups.filter(
    (item) => mapId === "all" || item.mapId === mapId,
  );
  if (!entered)
    return (
      <section className="admin-gate">
        <Icon name="crosshair" size={40} />
        <h1>O repertório do time começa aqui.</h1>
        <p>
          Cadastre os vídeos, marque os destinos e organize as granadas por
          mapa.
        </p>
        <div className="inline-notice">
          <strong>Administração em demonstração</strong>
          <p>
            O login ainda não foi integrado. Você pode explorar os formulários
            com dados temporários; esta tela não representa uma área protegida.
          </p>
        </div>
        <button className="button primary" onClick={() => setEntered(true)}>
          Entrar na demonstração <Icon name="arrow" size={17} />
        </button>
      </section>
    );
  return (
    <>
      <div className="page-heading admin-heading">
        <div>
          <h1 ref={titleRef} tabIndex={-1}>
            Administração
          </h1>
          <p>Organize as granadas que o time vai treinar.</p>
        </div>
        <div className="admin-heading-actions">
          <button className="text-button" onClick={() => setEntered(false)}>
            Sair da demonstração
          </button>
          <button
            className="button primary"
            onClick={() => {
              setNotice("");
              setEditing("new");
            }}
          >
            <Icon name="plus" size={18} />
            Nova granada
          </button>
        </div>
      </div>
      <div className="admin-toolbar">
        <label className="map-select">
          Filtrar por mapa
          <select
            value={mapId}
            onChange={(event) => setMapId(event.target.value)}
          >
            <option value="all">Todos os mapas</option>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
        <p>Vídeos locais e cadastros só existem nesta sessão.</p>
      </div>
      {notice && (
        <p role="status" className="success-notice">
          <Icon name="check" size={17} />
          {notice}
        </p>
      )}
      <div className="admin-list" aria-label="Gerenciar granadas">
        {visible.map((item) => (
          <article className="admin-row" key={item.id}>
            <span className={`type-icon ${item.type}`}>
              <Icon name={item.type} />
            </span>
            <div className="admin-row-title">
              <h2>{item.title}</h2>
              <p>
                {maps.find((map) => map.id === item.mapId)?.name}{" "}
                <span aria-hidden="true">·</span> {typeLabels[item.type]}{" "}
                <span aria-hidden="true">·</span> Lado {item.side}
              </p>
            </div>
            <span
              className={`media-status ${item.video.status === "failed" ? "failed" : ""}`}
            >
              {item.video.playbackUrl?.startsWith("blob:")
                ? "Prévia local"
                : videoLabels[item.video.status]}
            </span>
            <div className="admin-row-actions">
              <button
                className="icon-button"
                aria-label={`Editar ${item.title}`}
                onClick={() => {
                  setNotice("");
                  setEditing(item);
                }}
              >
                <Icon name="edit" size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={`Excluir ${item.title}`}
                onClick={() => {
                  setError(undefined);
                  setRemoving(item);
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <h2>Nenhuma granada cadastrada</h2>
          <p>Crie uma granada para testar o formulário neste mapa.</p>
        </div>
      )}
      <div className="pipeline-note">
        <h2>Como o vídeo ficará disponível</h2>
        <p>
          O fluxo integrado previsto é: envio ou importação → na fila →
          processamento → vídeo pronto. Se houver falha, será possível enviar um
          MP4. Nesta prévia, somente o player local pode ser testado.
        </p>
      </div>
      {editing && (
        <LineupForm
          maps={maps}
          existing={editing === "new" ? undefined : editing}
          service={service}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            onSaved(item);
            setEditing(null);
            setNotice(
              "Granada salva na demonstração. Ela será perdida ao recarregar a página.",
            );
          }}
        />
      )}
      {removing && (
        <Dialog
          title="Excluir granada?"
          description={`“${removing.title}” será removida desta demonstração. O conteúdo inicial volta ao recarregar a página.`}
          onClose={() => setRemoving(null)}
          busy={busy}
        >
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await service.deleteLineup(removing.id);
                  onDeleted(removing.id);
                  setRemoving(null);
                  setNotice("Granada removida da demonstração.");
                  requestAnimationFrame(() => titleRef.current?.focus());
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível excluir. Tente novamente.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Excluindo…" : "Excluir demonstração"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
