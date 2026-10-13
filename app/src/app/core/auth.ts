import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { createAuthClient } from '@neondatabase/auth';
import { NEON } from './neon-config';

export interface SignedInUser {
  id: string;
  email: string;
  name: string;
}

/** The slice of the Neon Auth client the app uses; tests replace it. */
export interface AuthClientLike {
  getSession(): Promise<{ data: { user: SignedInUser } | null; error: unknown }>;
  signIn: { social(o: { provider: 'google'; callbackURL: string }): Promise<unknown> };
  signOut(): Promise<unknown>;
  /** A Data API JWT for the current session, or null when signed out. */
  jwt(): Promise<string | null>;
}

export const AUTH_CLIENT = new InjectionToken<AuthClientLike>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const sdk = createAuthClient(NEON.authUrl);
    return {
      getSession: () => sdk.getSession() as ReturnType<AuthClientLike['getSession']>,
      signIn: { social: (o) => sdk.signIn.social(o) },
      signOut: () => sdk.signOut(),
      jwt: async () => (await sdk.token()).data?.token ?? null,
    };
  },
});

/** The JWT's exp in ms; a token that can't be read is treated as nearly expired. */
function expiresAt(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : Date.now() + 60_000;
  } catch {
    return Date.now() + 60_000;
  }
}

/** Google sign-in through Neon Auth, and the short-lived token the Data API needs. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly client = inject(AUTH_CLIENT);
  private readonly current = signal<SignedInUser | null>(null);
  readonly user = this.current.asReadonly();
  private loaded: Promise<SignedInUser | null> | null = null;
  private cached: { token: string; exp: number } | null = null;

  /** Once per page load. The SDK also completes the OAuth return here. */
  session(): Promise<SignedInUser | null> {
    this.loaded ??= this.client
      .getSession()
      .then(({ data }) => (data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null))
      .catch(() => null)
      .then((user) => {
        this.current.set(user);
        return user;
      });
    return this.loaded;
  }

  async token(): Promise<string | null> {
    if (this.cached && this.cached.exp - 60_000 > Date.now()) return this.cached.token;
    const token = await this.client.jwt();
    this.cached = token ? { token, exp: expiresAt(token) } : null;
    return token;
  }

  dropToken(): void {
    this.cached = null;
  }

  async signIn(next: string): Promise<void> {
    await this.client.signIn.social({ provider: 'google', callbackURL: `${location.origin}${next}` });
  }

  async signOut(): Promise<void> {
    await this.client.signOut();
    this.cached = null;
    this.loaded = null;
    this.current.set(null);
  }
}
