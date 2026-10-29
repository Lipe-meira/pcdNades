import { createClient } from "@supabase/supabase-js";
import { ApiClient, ApiError } from "./apiClient";
import { createApiService } from "./apiService";
import type { AuthIdentity, AuthService } from "./auth";
import type { RuntimeConfig } from "./runtimeConfig";

export function createSupabaseRuntime(
  config: Extract<RuntimeConfig, { mode: "api" }>,
) {
  const supabase = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  const api = new ApiClient(config.apiBaseUrl, async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new ApiError("UNAUTHORIZED", 401);
    return data.session?.access_token ?? null;
  });
  const service = createApiService(api, async (session, file) => {
    const signed = new URL(session.upload.url);
    if (
      signed.origin !== new URL(config.supabaseUrl).origin ||
      !signed.pathname.startsWith(
        "/storage/v1/object/upload/sign/videos-staging/",
      )
    )
      throw new Error(
        "A sessão de upload aponta para um armazenamento diferente do configurado.",
      );
    const { error } = await supabase.storage
      .from("videos-staging")
      .uploadToSignedUrl(session.upload.path, session.upload.token, file, {
        contentType: "video/mp4",
      });
    if (error)
      throw new ApiError(
        "UPLOAD_FAILED",
        0,
        undefined,
        "Não foi possível enviar o arquivo. O cadastro anterior não foi alterado. Tente novamente.",
      );
  });
  function identity(
    user?: { id: string; email?: string } | null,
  ): AuthIdentity | null {
    return user
      ? { id: user.id, email: user.email ?? "Conta autenticada" }
      : null;
  }
  const auth: AuthService = {
    async identity() {
      const { data, error } = await supabase.auth.getSession();
      if (error)
        throw new Error(
          "Não foi possível verificar a sessão. Tente novamente.",
        );
      return identity(data.session?.user);
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw new Error(
          "Não foi possível entrar. Confira e-mail e senha ou tente novamente mais tarde.",
        );
    },
    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error)
        throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
    },
    subscribe(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) =>
        listener(identity(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },
  };
  return { service, auth };
}
