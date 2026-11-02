// Run only after the orchestrator coordinates the local stack and source lease.
// Secrets and source links are supplied through the process environment.
import { chromium } from "@playwright/test";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} no ambiente privado.`);
  return value;
}
function localOrigin(value) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.protocol !== "http:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error("Use somente origens HTTP locais.");
  return url.origin;
}

const app = localOrigin(required("PREVIEW_TEST_APP_ORIGIN"));
const api = localOrigin(required("PREVIEW_TEST_API_ORIGIN"));
const storage = localOrigin(required("PREVIEW_TEST_SUPABASE_ORIGIN"));
if (new URL(storage).port !== "56421") throw new Error("Supabase precisa usar a stack local coordenada.");
const email = required("PREVIEW_TEST_EMAIL");
const password = required("PREVIEW_TEST_PASSWORD");
const source = required("PREVIEW_TEST_SOURCE_URL");
const allowed = new Set([app, api, storage]);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let inspection = false, preview = false, media = false, unexpected = false;
try {
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!allowed.has(url.origin)) { unexpected = true; return route.abort(); }
    if (url.origin === api && request.method() !== "GET" &&
        /\/api\/v1\/(?:grenades|lineups)(?:\/|$)/.test(url.pathname)) {
      unexpected = true;
      return route.abort();
    }
    if (url.origin === api && request.method() === "POST" && url.pathname.endsWith("/media/imports/inspect")) inspection = true;
    if (url.origin === api && request.method() === "POST" && /\/media\/imports\/[^/]+\/preview$/.test(url.pathname)) preview = true;
    if (url.origin === storage && url.pathname.startsWith("/storage/v1/object/sign/import-previews/")) media = true;
    await route.continue();
  });
  const page = await context.newPage();
  await page.goto(app);
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByRole("button", { name: "Importar por link", exact: true }).click();
  await page.getByLabel("Link do YouTube Shorts, TikTok ou Instagram Reels", { exact: true }).fill(source);
  await page.getByRole("button", { name: "Consultar vídeo", exact: true }).click();
  const video = page.getByLabel("Prévia do vídeo de origem", { exact: true });
  await video.waitFor({ state: "visible", timeout: 150000 });
  await page.waitForFunction(() => {
    const v = document.querySelector('video[aria-label="Prévia do vídeo de origem"]');
    return v && v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 1;
  }, undefined, { timeout: 30000 });
  const position = await video.evaluate(async v => {
    v.muted = true;
    await v.play();
    await new Promise(resolve => setTimeout(resolve, 500));
    v.pause();
    return v.currentTime;
  });
  if (!(position > 0)) throw new Error("A prévia não avançou.");
  await page.getByRole("button", { name: "Usar posição como início" }).click();
  const start = await page.getByLabel("Início do trecho", { exact: true }).inputValue();
  await video.evaluate(v => new Promise(resolve => {
    v.addEventListener("seeked", resolve, { once: true });
    v.currentTime = Math.min(v.duration - 0.1, v.currentTime + 0.5);
  }));
  await page.getByRole("button", { name: "Usar posição como fim" }).click();
  const end = await page.getByLabel("Fim do trecho", { exact: true }).inputValue();
  if (!inspection || !preview || !media || unexpected || !start || !end || start === end)
    throw new Error("Ensaio incompleto: confira player, marcações e tráfego local.");
  process.stdout.write("PASS: prévia local reproduzida e tempos marcados; nenhuma granada criada.\n");
} catch {
  process.stderr.write("Falha no ensaio local; confira a stack e a disponibilidade da prévia sem expor URLs ou credenciais.\n");
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
