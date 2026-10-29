import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../src/services/runtimeConfig";
import { ApiClient, ApiError } from "../src/services/apiClient";

describe("seleção explícita de ambiente", () => {
  it("abre demo sem configuração e exige env completa para api", () => {
    expect(readRuntimeConfig({})).toEqual({ mode: "demo" });
    expect(() => readRuntimeConfig({ VITE_DATA_MODE: "api" })).toThrow(
      "configuração",
    );
    expect(
      readRuntimeConfig({ VITE_DATA_MODE: "demo", VITE_API_URL: "invalid" }),
    ).toEqual({ mode: "demo" });
    expect(() => readRuntimeConfig({ VITE_DATA_MODE: "surprise" })).toThrow();
    expect(
      readRuntimeConfig({
        VITE_DATA_MODE: "api",
        VITE_API_URL: "http://localhost:3000/api/v1/",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toMatchObject({
      mode: "api",
      apiBaseUrl: "http://localhost:3000/api/v1",
    });
  });
  it("recusa URLs inseguras e chave secreta no bundle", () => {
    const env = {
      VITE_DATA_MODE: "api",
      VITE_API_URL: "https://example.com/api/v1",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    };
    expect(() =>
      readRuntimeConfig({
        ...env,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never_use",
      }),
    ).toThrow();
    expect(() =>
      readRuntimeConfig({
        ...env,
        VITE_API_URL: "http://public.example.com/api/v1",
      }),
    ).toThrow();
    expect(() =>
      readRuntimeConfig({
        ...env,
        VITE_API_URL: "https://user:password@example.com/api/v1",
      }),
    ).toThrow();
  });
});

describe("cliente API v1", () => {
  it("codifica filtros e adiciona token só nas chamadas autenticadas", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const client = new ApiClient(
      "https://api.example.com/api/v1",
      async () => "controlled-test-token",
      async (url, init) => {
        requests.push({ url: String(url), init });
        return Response.json({ data: [] });
      },
    );
    await client.request("/grenades", {
      query: { mapId: "mapa & teste", limit: 100, offset: 0 },
    });
    await client.request("/grenades/id", {
      method: "PATCH",
      body: { title: "Editado" },
      authenticated: true,
    });
    expect(new URL(requests[0].url).searchParams.get("mapId")).toBe(
      "mapa & teste",
    );
    expect(new Headers(requests[0].init?.headers).has("Authorization")).toBe(
      false,
    );
    expect(new Headers(requests[1].init?.headers).get("Authorization")).toBe(
      "Bearer controlled-test-token",
    );
    expect(JSON.parse(requests[1].init!.body as string)).toEqual({
      title: "Editado",
    });
  });
  it("preserva código/campos do erro e aceita exclusão 204", async () => {
    const client = new ApiClient(
      "/api/v1",
      async () => "controlled-test-token",
      async () => new Response(null, { status: 204 }),
    );
    expect(
      await client.request("/grenades/id", {
        method: "DELETE",
        authenticated: true,
      }),
    ).toBeUndefined();
    const failed = new ApiClient(
      "/api/v1",
      async () => null,
      async () =>
        Response.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "FORBIDDEN",
              fields: { title: "Inválido" },
            },
          },
          { status: 403 },
        ),
    );
    await expect(failed.request("/grenades")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      fields: { title: "Inválido" },
    });
    await expect(failed.request("/grenades")).rejects.toThrow("permissão");
  });
  it("não envia escrita sem sessão e não transforma falha remota em demo", async () => {
    let called = false;
    const client = new ApiClient(
      "/api/v1",
      async () => null,
      async () => {
        called = true;
        throw new TypeError("network");
      },
    );
    await expect(
      client.request("/grenades", { authenticated: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(called).toBe(false);
    await expect(client.request("/maps")).rejects.toBeInstanceOf(ApiError);
    expect(called).toBe(true);
  });
});
