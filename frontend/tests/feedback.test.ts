import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { loginFailureMessage } from "../src/services/supabaseRuntime";

describe("mensagem de falha de login", () => {
  it("informa conexão, não credencial, quando o servidor de login está inacessível", () => {
    const message = loginFailureMessage({ name: "AuthRetryableFetchError", status: 0 });
    expect(message).toContain("conectar ao servidor de login");
    expect(message).not.toContain("e-mail e senha");
  });

  it("trata erro 5xx do servidor de login como indisponibilidade", () => {
    expect(loginFailureMessage({ status: 503 })).toContain("conectar ao servidor de login");
  });

  it("mantém a orientação de credencial para senha ou e-mail incorretos", () => {
    expect(loginFailureMessage({ name: "AuthApiError", status: 400 })).toContain("Confira e-mail e senha");
  });
});

describe("mensagem de resposta inesperada da API", () => {
  it("não expõe o termo técnico 'API' ao usuário", async () => {
    const client = new ApiClient("/api/v1", async () => null, async () =>
      new Response("<html>erro</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
    );
    await expect(client.request("/lineups")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "O servidor respondeu de forma inesperada. Tente novamente mais tarde.",
    });
  });
});
