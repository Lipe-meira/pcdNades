export type AuthIdentity = { id: string; email: string };
export interface AuthService {
  identity(): Promise<AuthIdentity | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (identity: AuthIdentity | null) => void): () => void;
}
