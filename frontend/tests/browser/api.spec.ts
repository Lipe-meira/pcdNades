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
const importId = "66666666-6666-4666-8666-666666666666";
const importLimits = { maxSourceDurationSeconds: 7200, maxDurationSeconds: 90, maxBytes: 50_000_000, minDurationSeconds: .1, timePrecisionSeconds: .001 };
function importInspection(number = 1) { return {
  sourceId: `bbbbbbbb-bbbb-4bbb-8bbb-${String(number).padStart(12, "0")}`,
  provider: "tiktok", sourceUrl: "https://www.tiktok.com/@qa/video/1234567890", videoId: "1234567890",
  title: `Fonte controlada ${number}`, author: "Time QA", durationSeconds: 7200,
  expiresAt: new Date(Date.now() + 900_000).toISOString(), preview: null, previewReasonCode: "PREVIEW_UNAVAILABLE", limits: importLimits,
}; }
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
  origin: null as { x: number; y: number } | null,
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
    imports?: boolean;
    importDelay?: number;
    importFailure?: string;
    loseImportComplete?: boolean;
    busyImportSecond?: boolean;
  } = {},
) {
  const state = {
    unavailable: false,
    published: options.initial ? [structuredClone(grenade)] : ([] as (typeof grenade)[]),
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
    inspections: 0, importCreates: 0, importCompletes: 0, importReady: false,
    inspection: importInspection(),
  };
  const imported = () => ({ ...media, id: importId, mediaId: importId, sourceId: state.inspection.sourceId,
    sourceType: "tiktok", sourceUrl: state.inspection.sourceUrl, clip: state.clip,
    status: state.importReady ? "ready" : "processing", stage: state.importReady ? null : "downloading" });
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
              tiktok: options.imports ? { enabled: true, inspection: true, ...importLimits } : { enabled: false },
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
    if (path === "/media/imports/inspect") {
      state.inspections++;
      state.inspection = importInspection(state.inspections);
      return reply(route, { status: 201, json: { data: state.inspection } });
    }
    if (path === "/media/imports") {
      state.importCreates++;
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(["clip", "sourceId"]);
      expect(body.sourceId).toBe(state.inspection.sourceId);
      state.clip = body.clip;
      return reply(route, { status: 201, json: { data: { ...imported(), status: "queued" } } });
    }
    if (path === `/media/${importId}`) return reply(route, { json: { data: imported() } });
    if (path === `/media/${importId}/complete`) {
      state.importCompletes++;
      expect(route.request().postDataJSON()).toEqual({});
      if (options.loseImportComplete && state.importCompletes === 1) return route.abort("failed");
      if (options.busyImportSecond && state.importCompletes === 2)
        return reply(route, { status: 503, json: { error: { code: "PROCESSOR_BUSY" } } });
      if (options.importDelay) await new Promise(resolve => setTimeout(resolve, options.importDelay));
      if (options.importFailure) return reply(route, { json: { data: { ...imported(), status: "failed", error: { code: options.importFailure, message: "Falha controlada" } } } });
      state.importReady = true;
      return reply(route, { json: { data: imported() } });
    }
    if (path === "/grenades" && method === "POST" && route.request().postDataJSON().videoId === importId) {
      expect(state.importReady).toBe(true);
      state.published = [{ ...grenade, ...route.request().postDataJSON(), video: imported() }];
      return reply(route, { status: 201, json: { data: state.published[0] } });
    }
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
  await page.getByLabel("Origem X (%)").fill("20");
  await page.getByLabel("Origem Y (%)").fill("30");
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
  await page.getByLabel("Origem X (%)").fill("20");
  await page.getByLabel("Origem Y (%)").fill("30");
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
  await page.getByLabel("Origem X (%)").fill("20");
  await page.getByLabel("Origem Y (%)").fill("30");
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

test("vídeo compacto e amplo preservam o mesmo player, reprodução, foco e scroll", async ({ page }, testInfo) => {
  const state = await setup(page, { initial: true });
  state.allowLongLease = true;
  state.published.push({ ...grenade, id: "44444444-4444-4444-8444-444444444444", title: "Segunda granada", video: { ...media, id: "55555555-5555-4555-8555-555555555555" } });
  await page.goto("/");
  await page.getByRole("button", { name: /^Granada de teste controlado Smoke/ }).click();
  const video = page.getByLabel("Vídeo da granada", { exact: true });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate((node: HTMLVideoElement) => { node.pause(); node.currentTime = .7; node.volume = .37; node.muted = true; node.loop = true; });
  const original = await video.elementHandle();
  const expand = page.getByRole("button", { name: "Ampliar vídeo", exact: true });
  await expand.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  const smallWidth = await video.evaluate(node => node.getBoundingClientRect().width);
  const leaseCount = state.playback;
  await expand.click();
  const back = page.getByRole("button", { name: "Voltar ao modo compacto", exact: true });
  await expect(back).toBeFocused();
  await expect(page.locator("video")).toHaveCount(1);
  expect(await video.evaluate((node, previous) => node === previous, original)).toBe(true);
  expect(await video.evaluate((node: HTMLVideoElement) => ({ paused: node.paused, volume: node.volume, muted: node.muted }))).toEqual({ paused: true, volume: .37, muted: true });
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeCloseTo(.7, 1);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(state.playback).toBe(leaseCount);
  if (testInfo.project.name === "api-desktop") expect(await video.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(smallWidth + 200);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.seeking && node.readyState >= 2)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("video-wide.png"), fullPage: true });
  await back.click();
  await expect(expand).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  expect(await video.evaluate((node, previous) => node === previous, original)).toBe(true);
  await video.evaluate(async (node: HTMLVideoElement) => { node.playbackRate = .25; await node.play(); });
  await expand.click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  expect(await video.evaluate((node, previous) => node === previous, original)).toBe(true);
  await video.evaluate((node: HTMLVideoElement) => node.pause());
  await page.getByRole("button", { name: /^Segunda granada Smoke/ }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((node, previous) => node === previous, original)).toBe(false);
  await expect(back).toHaveCount(0);
  await expand.click();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await video.evaluate(node => getComputedStyle(node).objectFit)).toBe("contain");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.seeking && node.readyState >= 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("video-wide-320.png"), fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("video-wide-landscape.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
});

test("vídeo amplo mantém renovação, erro claro e cleanup do player", async ({ page }) => {
  const state = await setup(page, { initial: true });
  await page.goto("/");
  await page.getByRole("button", { name: /^Granada de teste controlado Smoke/ }).click();
  const video = page.getByLabel("Vídeo da granada", { exact: true });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate((node: HTMLVideoElement) => { node.pause(); node.currentTime = .7; node.volume = .31; node.muted = true; });
  const original = await video.elementHandle();
  const initialLeaseCount = state.playback;
  await page.getByRole("button", { name: "Ampliar vídeo", exact: true }).click();
  state.allowLongLease = true;
  await expect.poll(() => state.playback, { timeout: 8000 }).toBeGreaterThan(initialLeaseCount);
  await expect(video).toHaveAttribute("src", new RegExp("v=" + (initialLeaseCount + 1) + "$"));
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(.6);
  expect(await video.evaluate((node, previous) => node === previous, original)).toBe(true);
  expect(await video.evaluate((node: HTMLVideoElement) => ({ paused: node.paused, volume: node.volume, muted: node.muted }))).toEqual({ paused: true, volume: .31, muted: true });
  await video.evaluate(node => node.dispatchEvent(new Event("error")));
  await expect(page.getByRole("alert")).toContainText("Vídeo indisponível");
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar ao modo compacto", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vídeo indisponível");
  await page.getByRole("button", { name: "Ampliar vídeo", exact: true }).click();
  await page.route(`${api}/media/*/playback`, route => reply(route, { status: 503, json: { error: { code: "SERVICE_UNAVAILABLE", message: "Serviço de vídeo indisponível." } } }));
  await page.getByRole("button", { name: "Tentar reproduzir novamente", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vídeo indisponível");
  await page.unroute(`${api}/media/*/playback`);
  state.allowLongLease = false;
  await page.getByRole("button", { name: "Tentar reproduzir novamente", exact: true }).click();
  await expect(video).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fechar detalhes", exact: true }).click();
  const callsBeforeWait = state.playback;
  await expect(page.locator("video")).toHaveCount(0);
  // The controlled lease renews after 4s; an unmounted player must cancel its timer.
  await page.waitForTimeout(4500);
  expect(state.playback).toBe(callsBeforeWait);
});

test("origens distintas no mesmo destino abrem a execução correta e legados não inventam pontos", async ({ page }, testInfo) => {
  const state = await setup(page, { initial: true });
  state.allowLongLease = true;
  state.published[0].origin = { x: 0, y: 1 };
  state.published.push({ ...grenade, id: "origin-second", title: "Outra origem", origin: { x: .8, y: .2 }, video: { ...media, id: "other-media" } });
  state.published.push({ ...grenade, id: "origin-legacy", title: "Cadastro legado", origin: null, target: { x: .9, y: .8 } });
  await page.goto("/");
  const destination = page.getByRole("button", { name: "2 granadas neste destino", exact: true });
  await destination.click();
  const first = page.getByRole("button", { name: "Origem de Granada de teste controlado", exact: true });
  const second = page.getByRole("button", { name: "Origem de Outra origem", exact: true });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(page.locator(".origin-connections line")).toHaveCount(2);
  const image = page.getByAltText("Radar do mapa Mirage");
  const bounds = (await image.boundingBox())!;
  const originBox = (await first.boundingBox())!;
  expect((originBox.x + originBox.width / 2 - bounds.x) / bounds.width).toBeCloseTo(0, 3);
  expect((originBox.y + originBox.height / 2 - bounds.y) / bounds.height).toBeCloseTo(1, 3);
  await page.screenshot({ path: testInfo.outputPath("origin-group.png"), fullPage: true });
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Detalhes da granada" }).getByRole("heading", { name: "Outra origem", exact: true })).toBeVisible();
  await expect(page.locator(".origin-connections line")).toHaveCount(1);
  await expect(page.getByLabel("Vídeo da granada", { exact: true })).toBeVisible();
  expect(state.calls).toContain("GET /media/other-media/playback");
  await page.getByRole("button", { name: "Ampliar vídeo", exact: true }).click();
  await page.keyboard.press("Escape");
  await destination.click();
  await first.click();
  await expect(page.getByText("Origem no radar: 0%, 100%.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Cadastro legado Smoke/ }).click();
  await expect(page.getByText("Origem não cadastrada.", { exact: true })).toBeVisible();
  await expect(page.locator(".origin-marker")).toHaveCount(0);
  await expect(page.locator(".origin-connections line")).toHaveCount(0);
});

test("edição de origem: PATCH omitido preserva, coordenadas zero adicionam e null remove", async ({ page }) => {
  const state = await setup(page, { initial: true });
  await page.route(`${api}/maps`, route => reply(route, { json: { data: ["mirage", "inferno"].map(id => ({
    id, name: id === "mirage" ? "Mirage" : "Inferno", radar: { imageUrl: `/maps/${id}.svg`, width: 1024, height: 1024, coordinateVersion: `setpos-${id}-ba5f793` },
  })) } }));
  const bodies: Record<string, unknown>[] = [];
  await page.route(`${api}/grenades/${grenade.id}`, async route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    state.published[0] = { ...state.published[0], ...body };
    await reply(route, { json: { data: state.published[0] } });
  });
  await page.goto("/");
  await signIn(page);
  const edit = page.getByRole("button", { name: "Editar Granada de teste controlado", exact: true });
  await edit.click();
  await expect(page.getByText(/Origem não cadastrada\. Este cadastro antigo/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(Object.hasOwn(bodies[0], "origin")).toBe(false);
  await edit.click();
  await page.getByLabel("Origem X (%)", { exact: true }).fill("0");
  await page.getByLabel("Origem Y (%)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies[1].origin).toEqual({ x: 0, y: 1 });
  await edit.click();
  await page.getByLabel("Mapa", { exact: true }).selectOption("inferno");
  await expect(page.getByLabel("Origem X (%)", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Coordenada X (%)", { exact: true })).toHaveValue("");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill("40");
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Marque onde o jogador lança");
  expect(bodies).toHaveLength(2);
  await page.getByLabel("Mapa", { exact: true }).selectOption("mirage");
  await expect(page.getByLabel("Origem X (%)", { exact: true })).toHaveValue("");
  await page.getByLabel("Origem X (%)", { exact: true }).fill("0");
  await page.getByLabel("Origem Y (%)", { exact: true }).fill("100");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill("40");
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies[2].origin).toEqual({ x: 0, y: 1 });
  await edit.click();
  await page.getByRole("button", { name: "Remover origem", exact: true }).click();
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies[3].origin).toBeNull();
  await edit.click();
  await page.getByLabel("Mapa", { exact: true }).selectOption("inferno");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill("30");
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Salvar granada", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies[4].origin).toBeNull();
  expect(bodies[4].mapId).toBe("inferno");
});

async function openImportForm(page: Page, editing = false) {
  await page.goto("/"); await signIn(page);
  if (editing) await page.getByRole("button", { name: "Editar Granada de teste controlado", exact: true }).click();
  else {
    await page.getByRole("button", { name: "Nova granada", exact: true }).click();
    await page.getByLabel("Título", { exact: true }).fill("Trecho TikTok QA");
    await page.getByLabel("Instruções", { exact: true }).fill("Instruções preservadas da importação controlada.");
    await page.getByLabel("Origem X (%)", { exact: true }).fill("0");
    await page.getByLabel("Origem Y (%)", { exact: true }).fill("100");
    await page.getByLabel("Coordenada X (%)", { exact: true }).fill("40");
    await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("60");
  }
  await page.getByRole("button", { name: "Importar por link", exact: true }).click();
  await page.getByLabel("Link do YouTube Shorts, TikTok ou Instagram Reels", { exact: true }).fill("https://vt.tiktok.com/ZSgqvRtpM/");
}
async function consultImport(page: Page) {
  await page.getByRole("button", { name: /Consultar vídeo|Consultar novamente/, exact: true }).click();
  await expect(page.getByLabel("Início do trecho", { exact: true })).toBeVisible();
}

test("TikTok: metadados de fonte2h e trecho90 sem prévia falsa, antes de publicar", async ({ page }, testInfo) => {
  const state = await setup(page, { imports: true, importDelay: 5000 });
  const external: string[] = [];
  page.on("request", request => { if (new URL(request.url()).hostname.endsWith("tiktok.com")) external.push(request.url()); });
  await openImportForm(page);
  await page.getByRole("button", { name: "Verificar importação", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Consulte os dados");
  expect(state.importCreates).toBe(0);
  await consultImport(page);
  await expect(page.getByText("Duração da fonte: 02:00:00", { exact: true })).toBeVisible();
  await expect(page.getByText(/Prévia visual indisponível/)).toBeVisible();
  await expect(page.locator("iframe, .import-link-editor video")).toHaveCount(0);
  await expect(page.getByText("YouTube Shorts", { exact: true }).locator("..")).toContainText("Indisponível");
  await expect(page.getByText("Instagram Reels", { exact: true }).locator("..")).toContainText("Indisponível");
  await page.getByLabel("Início do trecho", { exact: true }).fill("01:58:29.999");
  await page.getByLabel("Fim do trecho", { exact: true }).fill("02:00:00");
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("90");
  expect(state.importCreates).toBe(0);
  await page.getByLabel("Início do trecho", { exact: true }).fill("01:58:30");
  await page.getByLabel("Fim do trecho", { exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("tiktok-selection.png") });
  await page.locator(".import-clip").evaluate(node => node.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: testInfo.outputPath("tiktok-range.png") });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 844 });
  await page.locator(".import-clip").evaluate(node => node.scrollIntoView({ block: "start" }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tiktok-range-320.png") });
  await page.setViewportSize(viewport);
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByText("Importando o trecho selecionado…", { exact: true })).toBeVisible({ timeout: 7000 });
  expect(state.published).toHaveLength(0);
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
  expect(state.clip).toEqual({ startSeconds: 7110, endSeconds: 7200 });
  expect(state.importCreates).toBe(1);
  expect(state.published[0].video.id).toBe(importId);
  await page.reload();
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Trecho TikTok QA Smoke/ })).toBeVisible();
  expect(external).toEqual([]);
});

test("TikTok: complete perdido e ocupado retomam o mesmo trecho sem nova sessão", async ({ page }) => {
  const state = await setup(page, { imports: true, loseImportComplete: true, busyImportSecond: true });
  await openImportForm(page); await consultImport(page);
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("conectar à API");
  await expect(page.getByText(/A importação já foi criada/)).toBeVisible();
  await page.getByRole("button", { name: "Retomar importação", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Outra importação está em processamento");
  expect(state.importCreates).toBe(1);
  await page.getByRole("button", { name: "Retomar importação", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.importCreates).toBe(1); expect(state.inspections).toBe(1); expect(state.importCompletes).toBe(3);
});

test("TikTok: troca do link aborta consulta antiga, limpa seleção e respeita expiração", async ({ page }) => {
  const state = await setup(page, { imports: true });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${api}/media/imports/inspect`, async route => {
    await gate; await reply(route, { status: 201, json: { data: { ...importInspection(99), title: "Resposta antiga não deve aparecer" } } }).catch(() => {});
  }, { times: 1 });
  await openImportForm(page);
  await page.getByRole("button", { name: "Consultar vídeo", exact: true }).click();
  await expect(page.getByText("Consultando os dados do vídeo…", { exact: true })).toBeVisible();
  const link = page.getByLabel("Link do YouTube Shorts, TikTok ou Instagram Reels", { exact: true });
  await link.fill("https://www.tiktok.com/@qa/video/9876543210"); release();
  await consultImport(page);
  await expect(page.getByText("Resposta antiga não deve aparecer", { exact: true })).toHaveCount(0);
  await link.fill("https://vt.tiktok.com/ZSgqvRtpM/");
  await expect(page.getByLabel("Início do trecho", { exact: true })).toHaveCount(0);
  await page.route(`${api}/media/imports/inspect`, async route => {
    state.inspection = { ...importInspection(2), expiresAt: new Date(0).toISOString() };
    await reply(route, { status: 201, json: { data: state.inspection } });
  }, { times: 1 });
  await consultImport(page);
  await expect(page.getByLabel("Início do trecho", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("expirou");
  expect(state.importCreates).toBe(0);
  await consultImport(page);
  await page.getByLabel("Início do trecho", { exact: true }).fill("1:60:00");
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("início e fim válidos");
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Trecho TikTok QA");
  await expect(page.getByLabel("Origem X (%)", { exact: true })).toHaveValue("0");
  await link.fill("https://www.youtube.com/shorts/abcdefghijk");
  await expect(page.getByRole("button", { name: "Consultar vídeo", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Início do trecho", { exact: true })).toHaveCount(0);
});

test("TikTok: falha final de tamanho preserva cadastro anterior e exige nova seleção", async ({ page }) => {
  const state = await setup(page, { initial: true, imports: true, importFailure: "FILE_TOO_LARGE" });
  await openImportForm(page, true); await consultImport(page);
  await page.getByRole("button", { name: "Importar trecho e salvar granada", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("tamanho permitido");
  expect(state.published).toHaveLength(1); expect(state.published[0].video.id).toBe(mediaId);
  await expect(page.getByLabel("Início do trecho", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retomar importação", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Granada de teste controlado");
  await page.getByRole("button", { name: "Manter vídeo", exact: true }).click();
  await expect(page.getByLabel("Vídeo da granada", { exact: true })).toBeVisible();
});

test("TikTok: consulta recusa fonte longa, falha de rede e duração desconhecida sem fingir prévia", async ({ page }) => {
  const state = await setup(page, { imports: true }); await openImportForm(page);
  await page.route(`${api}/media/imports/inspect`, route => reply(route, { status: 503, json: { error: { code: "PROCESSOR_BUSY" } } }), { times: 1 });
  await page.getByRole("button", { name: "Consultar vídeo", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("consulte o vídeo novamente");
  await expect(page.getByRole("button", { name: "Retomar importação", exact: true })).toHaveCount(0);
  await page.route(`${api}/media/imports/inspect`, route => reply(route, { status: 422, json: { error: { code: "SOURCE_TOO_LONG" } } }), { times: 1 });
  await page.getByRole("button", { name: "Consultar novamente", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("duas horas");
  await page.route(`${api}/media/imports/inspect`, route => route.abort("failed"), { times: 1 });
  await page.getByRole("button", { name: "Consultar novamente", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("conectar à API");
  await page.route(`${api}/media/imports/inspect`, route => reply(route, { status: 201, json: { data: { ...importInspection(), durationSeconds: null } } }), { times: 1 });
  await page.getByRole("button", { name: "Consultar novamente", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("contrato esperado");
  await expect(page.getByLabel("Início do trecho", { exact: true })).toHaveCount(0);
  expect(state.importCreates).toBe(0);
  await consultImport(page);
  await expect(page.getByText(/Prévia visual indisponível/)).toBeVisible();
});
