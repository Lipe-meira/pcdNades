// All API/Auth/Storage responses below are controlled fixtures, NOT a remote E2E test.
import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

function reply(route: Route, options: Parameters<Route["fulfill"]>[0]) {
  return route.fulfill({
    ...options,
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:5175",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers":
        route.request().headers()["access-control-request-headers"] ?? "*",
      ...options?.headers,
    },
  });
}

const api = "http://127.0.0.1:5999/api/v1";
const authOrigin = "http://127.0.0.1:5998";
const mediaId = "11111111-1111-4111-8111-111111111111";
const samplePath = fileURLToPath(
  new URL("../fixtures/test-pattern.mp4", import.meta.url),
);
const media = {
  id: mediaId,
  status: "ready",
  sourceType: "upload",
  sourceUrl: null,
  stage: null,
  error: null,
  metadata: { durationSeconds: 2 },
};
const grenade = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Granada de teste controlado",
  mapId: "mirage",
  type: "smoke",
  side: "T",
  instructions: "Instruções de QA com respostas controladas.",
  target: { x: 0.4, y: 0.6 },
  video: media,
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
};

async function setup(
  page: Page,
  options: {
    initial?: boolean;
    upload?: boolean;
    forbidden?: boolean;
    failFirstUpload?: boolean;
    inlineOriginal?: boolean;
    loseFirstComplete?: boolean;
    failFirstValidation?: boolean;
    trimming?: boolean;
    durationLimit?: number;
  } = {},
) {
  const state = {
    unavailable: false,
    published: options.initial ? [grenade] : ([] as (typeof grenade)[]),
    calls: [] as string[],
    playback: 0,
    polls: 0,
    signedUpload: false,
    queued: false,
    uploadSessions: 0,
    uploadAttempts: 0,
    allowLongLease: false,
    completes: 0,
    clip: null as { startSeconds: number; endSeconds: number } | null,
  };
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "controlled-user", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.dGVzdC1zaWduYXR1cmU`;
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "qa@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-29T12:00:00Z",
  };
  await page.route(`${authOrigin}/**`, async (route) => {
    if (route.request().method() === "OPTIONS")
      return reply(route, { status: 204 });
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/token")
      return reply(route, {
        json: {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "controlled-refresh-test-only",
          user,
        },
      });
    if (url.pathname === "/auth/v1/logout")
      return reply(route, { status: 204 });
    if (url.pathname === "/auth/v1/user") return reply(route, { json: user });
    if (
      url.pathname.startsWith("/storage/v1/object/upload/sign/videos-staging/")
    ) {
      state.uploadAttempts++;
      if (options.failFirstUpload && state.uploadAttempts === 1)
        return reply(route, {
          status: 400,
          json: { error: "Controlled upload failure" },
        });
      state.signedUpload = true;
      state.calls.push("SIGNED UPLOAD");
      return reply(route, {
        json: { Key: `videos-staging/${mediaId}/source.mp4` },
      });
    }
    return reply(route, {
      status: 404,
      json: { error: "Unexpected controlled auth route" },
    });
  });
  await page.route(`${api}/**`, async (route) => {
    if (route.request().method() === "OPTIONS")
      return reply(route, { status: 204 });
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    state.calls.push(`${method} ${path}`);
    if (state.unavailable)
      return reply(route, {
        status: 503,
        json: {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "SERVICE_UNAVAILABLE",
          },
        },
      });
    if (path === "/maps")
      return reply(route, {
        json: {
          data: [
            {
              id: "mirage",
              name: "Mirage",
              radar: {
                imageUrl: "/maps/mirage.svg",
                width: 1024,
                height: 1024,
                coordinateVersion: "setpos-mirage-ba5f793",
              },
            },
          ],
        },
      });
    if (path === "/media/capabilities")
      return reply(route, {
        json: {
          data: {
            upload: {
              enabled: options.upload !== false,
              maxBytes: 50_000_000,
              maxDurationSeconds: options.durationLimit ?? 20,
              ...(options.inlineOriginal
                ? { processingMode: "inline-original" }
                : {}),
            },
            importers: {
              youtube: { enabled: false },
              tiktok: { enabled: false },
              instagram: {
                enabled: false,
                reasonCode: "PLATFORM_UNSUPPORTED",
                message: "Integração ainda não habilitada.",
              },
            },
            ...(options.trimming !== undefined
              ? {
                  trimming: {
                    enabled: options.trimming,
                    reasonCode: options.trimming
                      ? undefined
                      : "CLIP_UNSUPPORTED",
                    maxSourceDurationSeconds: 180,
                    maxSourceBytes: 50_000_000,
                    maxDurationSeconds: options.durationLimit ?? 90,
                    minDurationSeconds: 0.1,
                    timePrecisionSeconds: 0.001,
                  },
                }
              : {}),
          },
        },
      });
    if (path === "/grenades" && method === "GET")
      return reply(route, {
        json: {
          data: state.published,
          pagination: { limit: 100, offset: 0, total: state.published.length },
        },
      });
    if (path.endsWith("/playback")) {
      state.playback++;
      return reply(route, {
        json: {
          data: {
            url: `http://127.0.0.1:5175/tests/fixtures/test-pattern.mp4?v=${state.playback}`,
            expiresAt: new Date(
              Date.now() + (state.allowLongLease ? 3_600_000 : 34_000),
            ).toISOString(),
            mimeType: "video/mp4",
          },
        },
      });
    }
    if (method !== "GET")
      expect(route.request().headers()["authorization"]).toBe(
        `Bearer ${accessToken}`,
      );
    if (options.forbidden && method !== "GET")
      return reply(route, {
        status: 403,
        json: { error: { code: "FORBIDDEN", message: "FORBIDDEN" } },
      });
    if (path === "/media/uploads") {
      state.uploadSessions++;
      state.clip = route.request().postData()
        ? (route.request().postDataJSON().clip ?? null)
        : null;
      return reply(route, {
        status: 201,
        json: {
          data: {
            mediaId,
            upload: {
              protocol: "supabase-signed",
              url: `${authOrigin}/storage/v1/object/upload/sign/videos-staging/${mediaId}/source.mp4?token=controlled`,
              path: `${mediaId}/source.mp4`,
              token: "controlled",
            },
            limits: {
              maxBytes: 50_000_000,
              maxDurationSeconds: options.durationLimit ?? 20,
            },
          },
        },
      });
    }
    if (path.endsWith("/complete")) {
      expect(state.signedUpload).toBe(true);
      state.completes++;
      if (options.loseFirstComplete && state.completes === 1)
        return route.abort("failed");
      if (options.failFirstValidation && state.completes === 1)
        return reply(route, {
          json: {
            data: {
              ...media,
              status: "failed",
              error: {
                code: "UNSUPPORTED_CODEC",
                message: "STACK_PRIVATE_PATH_MUST_NOT_BE_SHOWN",
              },
            },
          },
        });
      state.queued = true;
      if (options.inlineOriginal)
        return reply(route, {
          json: {
            data: {
              ...media,
              clip: state.clip,
              metadata: {
                durationSeconds: state.clip
                  ? state.clip.endSeconds - state.clip.startSeconds
                  : 2,
              },
            },
          },
        });
      return reply(route, {
        status: 202,
        json: { data: { ...media, status: "queued" } },
      });
    }
    if (path === `/media/${mediaId}`) {
      state.polls++;
      if (options.loseFirstComplete && state.completes === 1)
        return reply(route, {
          json: { data: { ...media, status: "awaiting_upload" } },
        });
      return reply(route, {
        json: {
          data: {
            ...media,
            clip: state.clip,
            status: state.polls === 1 ? "processing" : "ready",
          },
        },
      });
    }
    if (path === "/grenades" && method === "POST") {
      expect(state.queued).toBe(true);
      if (!options.inlineOriginal)
        expect(state.polls).toBeGreaterThanOrEqual(2);
      const body = route.request().postDataJSON();
      expect(body.videoId).toBe(mediaId);
      state.published = [
        { ...grenade, ...body, video: { ...media, clip: state.clip } },
      ];
      return reply(route, { status: 201, json: { data: state.published[0] } });
    }
    return reply(route, {
      status: 404,
      json: {
        error: {
          code: "NOT_FOUND",
          message: "Unexpected controlled API route",
        },
      },
    });
  });
  return state;
}

async function signIn(page: Page) {
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("qa@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("controlled-not-a-real-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nova granada", exact: true }),
  ).toBeVisible();
}

test("API vazia e indisponível nunca viram demonstração", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Nenhuma granada por aqui" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Tipo de granada" }).getByRole("button", { name: "Todas", exact: true })).toHaveAccessibleDescription("0 granadas");
  await expect(
    page.getByText("Modo demonstração.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Exemplo de/ })).toHaveCount(
    0,
  );
  state.unavailable = true;
  await page.getByRole("button", { name: "Atualizar biblioteca" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nenhum dado de demonstração foi usado",
  );
  await expect(page.getByRole("complementary", { name: "Filtros da biblioteca" })).toHaveCount(0);
  state.unavailable = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mirage", exact: true }),
  ).toBeVisible();
});

test("painel não mostra contagens durante loading nem sem mapas", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${api}/maps`, async (route) => {
    await gate;
    await reply(route, { json: { data: [] } });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Carregando biblioteca");
  await expect(page.getByRole("complementary", { name: "Filtros da biblioteca" })).toHaveCount(0);
  release();
  await expect(page.getByRole("heading", { name: "Nenhum mapa cadastrado" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Filtros da biblioteca" })).toHaveCount(0);
});

test("login, capabilities e logout com respostas controladas", async ({
  page,
}, testInfo) => {
  await setup(page, { upload: false });
  await page.goto("/");
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesso à administração" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("api-login.png"),
    fullPage: true,
  });
  await signIn(page);
  await expect(
    page.getByText("O envio de vídeos está indisponível no servidor.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await expect(page.getByLabel("Arquivo MP4", { exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("api-form.png") });
  await page
    .getByRole("button", { name: "Importar por link", exact: true })
    .click();
  await expect(
    page.getByText("Importação indisponível no servidor", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesso à administração" }),
  ).toBeVisible();
});

test("upload falho pode ser reenviado; acompanhamento retoma antes de publicar e recarrega", async ({
  page,
}) => {
  const state = await setup(page, { failFirstUpload: true });
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Cadastro API controlado");
  await page
    .getByLabel("Instruções", { exact: true })
    .fill("Teste de cadastro com transporte controlado.");
  await page.getByLabel("Coordenada X (%)").fill("40");
  await page.getByLabel("Coordenada Y (%)").fill("60");
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles(samplePath);
  await expect
    .poll(() =>
      page
        .getByLabel("Prévia do MP4 selecionado")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Não foi possível enviar o arquivo",
  );
  expect(state.uploadSessions).toBe(1);
  expect(state.published).toHaveLength(0);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByText("Na fila", { exact: true })).toBeVisible();
  expect(state.published).toHaveLength(0);
  await expect(
    page.getByText("Processando vídeo", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Parar acompanhamento", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Acompanhamento pausado",
  );
  expect(state.published).toHaveLength(0);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 12_000 });
  expect(state.calls.indexOf("SIGNED UPLOAD")).toBeLessThan(
    state.calls.indexOf(`POST /media/${mediaId}/complete`),
  );
  expect(state.uploadSessions).toBe(2);
  await expect(
    page.getByRole("heading", { name: "Cadastro API controlado", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cadastro API controlado", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page
    .getByRole("button", { name: /^Cadastro API controlado Smoke/ })
    .click();
  await expect(
    page.getByLabel("Vídeo da granada", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByLabel("Vídeo da granada", { exact: true })
        .evaluate((el: HTMLVideoElement) => el.duration),
    )
    .toBeGreaterThan(1);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("playback renova URL e preserva posição com respostas controladas", async ({
  page,
}) => {
  const state = await setup(page, { initial: true });
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Granada de teste controlado Smoke/ })
    .click();
  const video = page.getByLabel("Vídeo da granada", { exact: true });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
    el.pause();
    el.currentTime = 0.7;
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.6);
  const initialLeaseCount = state.playback;
  state.allowLongLease = true;
  await expect
    .poll(() => state.playback, { timeout: 8000 })
    .toBeGreaterThan(initialLeaseCount);
  await expect(video).toHaveAttribute(
    "src",
    new RegExp("v=" + (initialLeaseCount + 1) + "$"),
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.6);
});

test("403 não remove a granada nem afirma sucesso", async ({ page }) => {
  await setup(page, { initial: true, forbidden: true });
  await page.goto("/");
  await signIn(page);
  await page
    .getByRole("button", {
      name: "Excluir Granada de teste controlado",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Excluir granada", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "permissão de administrador",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Granada de teste controlado",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Granada excluída da biblioteca.", { exact: true }),
  ).toHaveCount(0);
});

async function fillInlineForm(page: Page) {
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Validação inline controlada");
  await page
    .getByLabel("Instruções", { exact: true })
    .fill("Instruções de QA, sem execução real.");
  await page.getByLabel("Coordenada X (%)").fill("40");
  await page.getByLabel("Coordenada Y (%)").fill("60");
  await expect(
    page.getByText("Envie o MP4 original", { exact: false }),
  ).toContainText("H.264");
  await expect(
    page.getByText("Envie o MP4 original", { exact: false }),
  ).toContainText("sem áudio");
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles(samplePath);
  await expect
    .poll(() =>
      page
        .getByLabel("Prévia do MP4 selecionado")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(1);
}

test("inline: perda da confirmação retoma awaiting_upload sem reenviar o arquivo", async ({
  page,
}) => {
  const state = await setup(page, {
    inlineOriginal: true,
    loseFirstComplete: true,
  });
  await page.goto("/");
  await signIn(page);
  await fillInlineForm(page);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toContainText("conectar à API");
  await expect(
    page.getByText("O arquivo já foi enviado.", { exact: false }),
  ).toBeVisible();
  expect(state.published).toHaveLength(0);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.uploadSessions).toBe(1);
  expect(state.uploadAttempts).toBe(1);
  expect(state.completes).toBe(2);
  expect(
    state.calls.filter((call) => call === `GET /media/${mediaId}`),
  ).toHaveLength(1);
  await expect(
    page.getByRole("heading", {
      name: "Validação inline controlada",
      exact: true,
    }),
  ).toBeVisible();
});

test("inline: codec inválido orienta exportação e nova escolha inicia outra sessão", async ({
  page,
}) => {
  const state = await setup(page, {
    inlineOriginal: true,
    failFirstValidation: true,
  });
  await page.goto("/");
  await signIn(page);
  await fillInlineForm(page);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toContainText("H.264");
  await expect(page.getByRole("alert").first()).not.toContainText(
    "STACK_PRIVATE_PATH",
  );
  expect(state.published).toHaveLength(0);
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles(samplePath);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles({
    name: "reexportado.mp4",
    mimeType: "video/mp4",
    buffer: await readFile(samplePath),
  });
  await expect
    .poll(() =>
      page
        .getByLabel("Prévia do MP4 selecionado")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.uploadSessions).toBe(2);
  expect(state.uploadAttempts).toBe(2);
});

test("recorte: prévia delimitada, erro de intervalo e sessão imutável com saída90", async ({
  page,
}, testInfo) => {
  const state = await setup(page, {
    inlineOriginal: true,
    trimming: true,
    durationLimit: 90,
  });
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Trecho controlado");
  await page
    .getByLabel("Instruções", { exact: true })
    .fill("Instruções fictícias para QA.");
  await page.getByLabel("Coordenada X (%)").fill("40");
  await page.getByLabel("Coordenada Y (%)").fill("60");
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/source-91s.mp4", import.meta.url)),
    );
  const preview = page.getByLabel("Prévia do MP4 selecionado");
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.duration))
    .toBeGreaterThan(90);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  expect(state.uploadSessions).toBe(0);
  await page
    .getByRole("checkbox", { name: "Selecionar trecho", exact: true })
    .check();
  await page.getByLabel("Início (segundos)", { exact: true }).fill("5");
  await page.getByLabel("Fim (segundos)", { exact: true }).fill("4");
  await expect(
    page.getByRole("button", { name: "Reproduzir trecho", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Início (segundos)", { exact: true }).fill("90.1");
  await page.getByLabel("Fim (segundos)", { exact: true }).fill("91");
  await page
    .getByRole("button", { name: "Reproduzir trecho", exact: true })
    .click();
  await expect
    .poll(() =>
      preview.evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThanOrEqual(90.1);
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true);
  expect(
    await preview.evaluate((video: HTMLVideoElement) => video.currentTime),
  ).toBeLessThanOrEqual(91.01);
  await page.getByLabel("Início (segundos)", { exact: true }).fill("1");
  await page.getByLabel("Fim (segundos)", { exact: true }).fill("91");
  await expect(
    page.getByRole("button", { name: "Reproduzir trecho", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("clip-selector.png") });
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.clip).toEqual({ startSeconds: 1, endSeconds: 91 });
  expect(state.uploadSessions).toBe(1);
});

test("recorte: capacidades disabled e reseleção preservam vídeo inteiro sem clip", async ({
  page,
}) => {
  const state = await setup(page, {
    inlineOriginal: true,
    trimming: false,
    durationLimit: 90,
  });
  await page.goto("/");
  await signIn(page);
  await fillInlineForm(page);
  await expect(
    page.getByRole("checkbox", { name: "Selecionar trecho", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles({
      name: "outro.mp4",
      mimeType: "video/mp4",
      buffer: await readFile(samplePath),
    });
  await expect
    .poll(() =>
      page
        .getByLabel("Prévia do MP4 selecionado")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await page
    .getByRole("button", { name: "Salvar granada", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.clip).toBeNull();
});


test("faixa API: sete mapas dinâmicos, rolagem local e falha de miniatura", async ({ page }, testInfo) => {
  await setup(page, { initial: true });
  const maps = ["Mirage", "Inferno", "Ancient", "Anubis", "Dust II", "Nuke", "Train"].map((name, index) => ({
    id: index === 0 ? "mirage" : `controlled-map-${index}`,
    name,
    radar: { imageUrl: `/maps/mirage.svg?fixture=${index}`, width:1024, height:1024, coordinateVersion:`controlled-version-${index}` },
  }));
  await page.route(`${api}/maps`, route => reply(route, { json: { data: maps } }));
  await page.goto("/");
  const rail = page.getByRole("navigation", { name: "Selecionar mapa" });
  await expect(rail.getByRole("button")).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("map-carousel.png"), fullPage:true });
  const first = rail.getByRole("button", { name:"Mirage", exact:true });
  await first.focus();
  const top = await page.evaluate(() => scrollY);
  await page.keyboard.press("End");
  const last = rail.getByRole("button", { name:"Train", exact:true });
  await expect(last).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(last).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name:"Train", exact:true })).toBeVisible();
  await expect(page.getByAltText("Radar do mapa Train")).toHaveAttribute("src", maps[6].radar.imageUrl);
  expect(await page.evaluate(() => scrollY)).toBe(top);
  expect(await last.evaluate(button => { const b=button.getBoundingClientRect(); const rail=button.closest('ul')!.getBoundingClientRect();return b.left>=rail.left && b.right<=rail.right; })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({ path:testInfo.outputPath("map-carousel-selected.png"), fullPage:true });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(() => last.evaluate(button => {
    const item = button.getBoundingClientRect();
    const frame = button.closest('ul')!.getBoundingClientRect();
    return item.left >= frame.left && item.right <= frame.right;
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-current", "true");
  await page.route("**/maps/mirage.svg?fixture=6", route => route.abort());
  await page.reload();
  await expect(rail.getByRole("button", { name:"Train", exact:true }).locator("img")).toHaveCount(0);
  await rail.getByRole("button", { name:"Train", exact:true }).click();
  await expect(page.getByRole("heading", { name:"Radar indisponível" })).toBeVisible();
  await first.click();
  await expect(page.getByAltText("Radar do mapa Mirage")).toBeVisible();
});

test("logos locais dos sete mapas e fallback sem usar radar como miniatura", async ({ page }, testInfo) => {
  await setup(page);
  const definitions = [
    ["mirage", "Mirage"], ["inferno", "Inferno"], ["ancient", "Ancient"],
    ["cache", "Cache"], ["nuke", "Nuke"], ["dust2", "Dust II"], ["anubis", "Anubis"],
    ["unknown-map", "Mapa novo"],
  ];
  await page.route(`${api}/maps`, (route) => reply(route, { json: { data: definitions.map(([id, name]) => ({
    id, name, radar: { imageUrl: `/maps/mirage.svg?logo-test=${id}`, width: 1024, height: 1024, coordinateVersion: `controlled-${id}` },
  })) } }));
  await page.goto("/");
  const rail = page.getByRole("navigation", { name: "Selecionar mapa" });
  for (const [id, name] of definitions.slice(0, 7)) {
    const image = rail.getByRole("button", { name, exact: true }).locator("img");
    await expect(image).toHaveAttribute("src", `/maps/icons/${id}.png`);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(512);
  }
  const unknown = rail.getByRole("button", { name: "Mapa novo", exact: true });
  await expect(unknown.locator("img")).toHaveCount(0);
  await unknown.click();
  await expect(unknown).toHaveAttribute("aria-current", "true");
  await expect(page.getByAltText("Radar do mapa Mapa novo")).toHaveAttribute("src", "/maps/mirage.svg?logo-test=unknown-map");
  await rail.getByRole("button", { name: "Mirage", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("map-logos.png"), fullPage: true });
  await page.route("**/maps/icons/mirage.png", (route) => route.abort());
  await page.reload();
  const mirage = rail.getByRole("button", { name: "Mirage", exact: true });
  await expect(mirage.locator("img")).toHaveCount(0);
  await expect(mirage).toHaveAttribute("aria-current", "true");
  await expect(page.getByAltText("Radar do mapa Mirage")).toBeVisible();
  await expect(rail.locator("img[src*='.svg']")).toHaveCount(0);
});
