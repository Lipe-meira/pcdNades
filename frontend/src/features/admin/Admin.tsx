import { useRef, useState } from "react";
import type { GameMap, Lineup } from "../../domain/types";
import { typeLabels, videoLabels } from "../../domain/types";
import type { LineupService } from "../../services/lineupService";
import type { MediaCapabilities } from "../../services/apiContracts";
import type { AuthIdentity } from "../../services/auth";
import { Icon } from "../../components/Icon";
import { Dialog } from "../../components/Dialog";
import { LineupForm } from "./LineupForm";

export function Admin({
  maps,
  lineups,
  capabilities,
  service,
  identity,
  signOut,
  onSaved,
  onDeleted,
}: {
  maps: GameMap[];
  lineups: Lineup[];
  capabilities: MediaCapabilities;
  service: LineupService;
  identity?: AuthIdentity;
  signOut?: () => Promise<void>;
  onSaved: (item: Lineup) => void;
  onDeleted: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [editing, setEditing] = useState<Lineup | "new" | null>(null);
  const [removing, setRemoving] = useState<Lineup | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [mapId, setMapId] = useState("all");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const demo = service.mode === "demo";
  const visible = lineups.filter(
    (item) => mapId === "all" || item.mapId === mapId,
  );
  if (demo && !entered)
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
            Explore os formulários sem fazer login. Os dados são temporários e
            esta tela não representa uma área protegida.
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
          <button
            className="text-button"
            disabled={logoutBusy}
            onClick={async () => {
              if (demo) {
                setEntered(false);
                return;
              }
              setLogoutBusy(true);
              setError(undefined);
              try {
                await signOut?.();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível sair.",
                );
              } finally {
                setLogoutBusy(false);
              }
            }}
          >
            {demo ? "Sair da demonstração" : logoutBusy ? "Saindo…" : "Sair"}
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
            aria-label="Filtrar por mapa"
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
        <p>
          {demo
            ? "Vídeos locais e cadastros só existem nesta sessão."
            : `Conta: ${identity?.email ?? "autenticada"}. Permissões verificadas pelo servidor.`}
        </p>
      </div>
      {error && !removing && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!demo && !capabilities.upload.enabled && (
        <p className="inline-notice">
          O envio de vídeos está indisponível no servidor. Você pode consultar e
          editar os dados dos cadastros existentes.
        </p>
      )}
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
          <p>
            {demo
              ? "Crie uma granada para testar o formulário neste mapa."
              : "Cadastre a primeira granada deste mapa."}
          </p>
        </div>
      )}
      <div className="pipeline-note">
        <h2>Como o vídeo ficará disponível</h2>
        <p>
          {demo
            ? "O fluxo integrado previsto é: envio ou importação → na fila → processamento → vídeo pronto. Nesta prévia, somente o player local pode ser testado."
            : "O arquivo é enviado e validado antes da publicação. Você acompanha a fila e o processamento no formulário; a granada só é publicada quando o vídeo estiver pronto."}
        </p>
      </div>
      {editing && (
        <LineupForm
          maps={maps}
          existing={editing === "new" ? undefined : editing}
          capabilities={capabilities}
          service={service}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            onSaved(item);
            setEditing(null);
            setNotice(
              demo
                ? "Granada salva na demonstração. Ela será perdida ao recarregar a página."
                : "Granada salva na biblioteca compartilhada.",
            );
          }}
        />
      )}
      {removing && (
        <Dialog
          title="Excluir granada?"
          description={
            demo
              ? `“${removing.title}” será removida desta demonstração. O conteúdo inicial volta ao recarregar a página.`
              : `“${removing.title}” será excluída da biblioteca do time. Esta ação não pode ser desfeita.`
          }
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
                  setNotice(
                    demo
                      ? "Granada removida da demonstração."
                      : "Granada excluída da biblioteca.",
                  );
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
              {busy
                ? "Excluindo…"
                : demo
                  ? "Excluir demonstração"
                  : "Excluir granada"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
