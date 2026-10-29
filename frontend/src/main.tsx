import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { createRuntime } from "./services/runtime";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <p role="status" className="loading">
    Carregando pcdNades…
  </p>,
);
createRuntime(import.meta.env)
  .then(({ service, auth }) => {
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) service.dispose();
    });
    root.render(
      <StrictMode>
        <App service={service} auth={auth} />
      </StrictMode>,
    );
  })
  .catch((error) =>
    root.render(
      <main>
        <section className="empty-state" role="alert">
          <h1>Configuração indisponível</h1>
          <p>
            {error instanceof Error
              ? error.message
              : "Não foi possível iniciar o site."}
          </p>
          <p>
            Nenhum dado de demonstração foi carregado como substituição da API.
          </p>
        </section>
      </main>,
    ),
  );
