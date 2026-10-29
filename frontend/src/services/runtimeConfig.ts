export type RuntimeConfig =
  | { mode: "demo" }
  | {
      mode: "api";
      apiBaseUrl: string;
      supabaseUrl: string;
      publishableKey: string;
    };

export function safeHttpUrl(value: string): string {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error(
      "Use URL HTTPS, ou HTTP somente para desenvolvimento local.",
    );
  return url.toString().replace(/\/$/, "");
}

export function readRuntimeConfig(
  env: Record<string, string | undefined>,
): RuntimeConfig {
  const mode = env.VITE_DATA_MODE || "demo";
  if (mode === "demo") return { mode };
  if (mode !== "api") throw new Error("VITE_DATA_MODE deve ser demo ou api.");
  if (
    !env.VITE_API_URL ||
    !env.VITE_SUPABASE_URL ||
    !env.VITE_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error(
      "A configuração do modo API está incompleta. Configure URL da API, URL do Supabase e chave publicável.",
    );
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "Use uma chave Supabase publicável (sb_publishable_), nunca uma chave secreta ou service role no frontend.",
    );
  return {
    mode,
    apiBaseUrl: safeHttpUrl(env.VITE_API_URL),
    supabaseUrl: safeHttpUrl(env.VITE_SUPABASE_URL),
    publishableKey: key,
  };
}
