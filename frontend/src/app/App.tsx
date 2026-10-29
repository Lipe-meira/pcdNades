import { useEffect, useState } from "react";
import type { GameMap, Lineup } from "../domain/types";
import type { LineupService } from "../services/lineupService";
import type { MediaCapabilities } from "../services/apiContracts";
import type { AuthIdentity, AuthService } from "../services/auth";
import { Library } from "../features/library/Library";
import { Icon } from "../components/Icon";
import { Admin } from "../features/admin/Admin";
import { AuthGate } from "../features/admin/AuthGate";

export function App({
  service,
  auth,
}: {
  service: LineupService;
  auth?: AuthService;
}) {
  const [page, setPage] = useState(
    window.location.hash === "#admin" ? "admin" : "library",
  );
  const [data, setData] = useState<{
    maps: GameMap[];
    lineups: Lineup[];
    capabilities: MediaCapabilities;
  }>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const demo = service.mode === "demo";
  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    Promise.all([
      service.listMaps(controller.signal),
      service.listLineups(controller.signal),
      service.capabilities(controller.signal),
    ])
      .then(([maps, lineups, capabilities]) => {
        if (!controller.signal.aborted)
          setData({ maps, lineups, capabilities });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar a biblioteca.",
          );
      });
    return () => controller.abort();
  }, [service, attempt]);
  useEffect(() => {
    const listener = () =>
      setPage(window.location.hash === "#admin" ? "admin" : "library");
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  function admin(identity?: AuthIdentity, signOut?: () => Promise<void>) {
    if (!data) return null;
    return (
      <Admin
        maps={data.maps}
        lineups={data.lineups}
        capabilities={data.capabilities}
        service={service}
        identity={identity}
        signOut={signOut}
        onSaved={(item) =>
          setData((current) =>
            current
              ? {
                  ...current,
                  lineups: current.lineups.some(
                    (lineup) => lineup.id === item.id,
                  )
                    ? current.lineups.map((lineup) =>
                        lineup.id === item.id ? item : lineup,
                      )
                    : [...current.lineups, item],
                }
              : current,
          )
        }
        onDeleted={(id) =>
          setData((current) =>
            current
              ? {
                  ...current,
                  lineups: current.lineups.filter((item) => item.id !== id),
                }
              : current,
          )
        }
      />
    );
  }
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#biblioteca"
          aria-label="pcdNades, biblioteca"
        >
          pcd<span>Nades</span>
          <Icon name="crosshair" size={28} />
        </a>
        <nav aria-label="Navegação principal">
          <a
            href="#biblioteca"
            aria-current={page === "library" ? "page" : undefined}
          >
            Biblioteca
          </a>
          <a href="#admin" aria-current={page === "admin" ? "page" : undefined}>
            Administração
          </a>
        </nav>
        <span className="header-caption">A biblioteca do time</span>
      </header>
      <main id="conteudo">
        {demo ? (
          <div className="demo-banner">
            <Icon name="info" size={18} />
            <span>
              <strong>Modo demonstração.</strong> Cadastros temporários e pontos
              fictícios, sem conexão com servidor. Alterações serão perdidas ao
              recarregar.
            </span>
          </div>
        ) : (
          <div className="api-banner">
            <span>Biblioteca compartilhada · modo API</span>
            <button
              className="text-button"
              onClick={() => setAttempt((current) => current + 1)}
            >
              Atualizar biblioteca
            </button>
          </div>
        )}
        {error ? (
          <div className="empty-state" role="alert">
            <h1>Não foi possível carregar a biblioteca</h1>
            <p>{error}</p>
            {!demo && (
              <p>
                Nenhum dado de demonstração foi usado para substituir a API.
              </p>
            )}
            <button
              className="button primary"
              onClick={() => setAttempt((current) => current + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : !data ? (
          <p className="loading" role="status">
            Carregando biblioteca…
          </p>
        ) : !data.maps.length ? (
          <section className="empty-state">
            <h1>Nenhum mapa cadastrado</h1>
            <p>
              O responsável pelo site precisa adicionar os mapas e seus radares
              antes do primeiro cadastro.
            </p>
          </section>
        ) : page === "library" ? (
          <Library maps={data.maps} lineups={data.lineups} service={service} />
        ) : !demo && auth ? (
          <AuthGate auth={auth}>
            {(identity, signOut) => admin(identity, signOut)}
          </AuthGate>
        ) : demo ? (
          admin()
        ) : (
          <p role="alert">
            A autenticação não foi configurada. A administração está
            indisponível.
          </p>
        )}
      </main>
      <footer className="app-footer">
        <span>
          pcdNades <span aria-hidden="true">/</span> Feito para treinar em
          equipe.
        </span>
        <span>{demo ? "Prévia de interface" : "Biblioteca do time"} · CS2</span>
      </footer>
    </>
  );
}
