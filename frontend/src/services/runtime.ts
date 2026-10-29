import { createDemoService } from "./lineupService";
import { readRuntimeConfig } from "./runtimeConfig";
import type { LineupService } from "./lineupService";
import type { AuthService } from "./auth";

export async function createRuntime(
  env: Record<string, string | undefined>,
): Promise<{ service: LineupService; auth?: AuthService }> {
  const config = readRuntimeConfig(env);
  if (config.mode === "demo") return { service: createDemoService() };
  // No catch/fallback: a configured API never turns into fixtures after an error.
  const { createSupabaseRuntime } = await import("./supabaseRuntime");
  return createSupabaseRuntime(config);
}
