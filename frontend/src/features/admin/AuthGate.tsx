import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AuthIdentity, AuthService } from "../../services/auth";
import { Icon } from "../../components/Icon";

export function AuthGate({
  auth,
  children,
}: {
  auth: AuthService;
  children: (identity: AuthIdentity, signOut: () => Promise<void>) => ReactNode;
}) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let authEvent = false;
    const unsubscribe = auth.subscribe((value) => {
      authEvent = true;
      if (active) {
        setIdentity(value);
        setLoading(false);
      }
    });
    auth
      .identity()
      .then((value) => {
        if (active && !authEvent) setIdentity(value);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível verificar a sessão. Entre novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);
  if (loading)
    return (
      <p role="status" className="loading">
        Verificando sessão…
      </p>
    );
  if (identity)
    return children(identity, async () => {
      await auth.signOut();
      setIdentity(null);
    });
  return (
    <section className="admin-gate auth-gate">
      <Icon name="crosshair" size={36} />
      <h1>Acesso à administração</h1>
      <p>Entre com a conta cadastrada para gerenciar as granadas do time.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(undefined);
          try {
            await auth.signIn(email, password);
            setPassword("");
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Não foi possível entrar.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="field-hint">
        A permissão de administrador é validada pelo servidor. Solicite uma
        conta ao responsável pelo time.
      </p>
    </section>
  );
}
