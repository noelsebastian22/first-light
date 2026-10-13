import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Auth } from './auth';
import { NEON } from './neon-config';

/** A failed Data API call. Status 0 means the network, not the server. */
export class DataApiError extends Error {
  constructor(readonly status: number) {
    super(`data api: HTTP ${status}`);
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

/** The Neon Data API (PostgREST) with the signed-in user's token. RLS does the rest. */
@Injectable({ providedIn: 'root' })
export class DataApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  async post(path: string, body: object): Promise<void> {
    await this.send<null>('POST', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.send<null>('DELETE', path);
  }

  rpc<T>(fn: string): Promise<T> {
    return this.send<T>('POST', `/rpc/${fn}`, {});
  }

  private async send<T>(method: Method, path: string, body?: object, retried = false): Promise<T> {
    const token = await this.auth.token();
    if (!token) throw new DataApiError(401);
    try {
      return await firstValueFrom(
        this.http.request<T>(method, `${NEON.dataApiUrl}${path}`, { body, headers: { Authorization: `Bearer ${token}` } }),
      );
    } catch (e) {
      if (!(e instanceof HttpErrorResponse)) throw e;
      if (e.status === 401 && !retried) {
        this.auth.dropToken();
        return this.send<T>(method, path, body, true);
      }
      throw new DataApiError(e.status);
    }
  }
}
