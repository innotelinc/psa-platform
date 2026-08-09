import type { Campaign, State } from './types';

let token = localStorage.getItem('ff_token') || '';

export const setToken = (t: string) => {
  token = t;
  if (t) localStorage.setItem('ff_token', t);
  else localStorage.removeItem('ff_token');
};
export const getToken = () => token;

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string }>('/auth/register', 'POST', { name, email, password }),
  login: (email: string, password: string) =>
    request<{ token: string }>('/auth/login', 'POST', { email, password }),
  forgotPassword: (email: string) =>
    request<{ message: string; newPassword: string }>('/auth/forgot-password', 'POST', { email }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', 'POST', { currentPassword, newPassword }),
  state: () => request<State>('/state'),
  updateState: (patch: any) => request<State>('/state', 'PUT', patch),
  updateChannel: (id: string, patch: any) => request<any>(`/channels/${id}`, 'PUT', patch),
  updateChannels: (channels: any[]) => request<any[]>('/channels', 'PUT', channels),
  dashboard: () => request<any>('/dashboard'),
  createCampaign: (c: Partial<Campaign>) => request<Campaign>('/campaigns', 'POST', c),
  updateCampaign: (id: string, c: Partial<Campaign>) => request<Campaign>(`/campaigns/${id}`, 'PUT', c),
  deleteCampaign: (id: string) => request<{ ok: boolean }>(`/campaigns/${id}`, 'DELETE'),
  runCampaignNow: (id: string) => request<{ posts: any[]; nextRunAt: number }>(`/campaigns/${id}/run-now`, 'POST'),
  createPost: (p: any) => request<any>('/posts', 'POST', p),
  deletePost: (id: string) => request<{ ok: boolean }>(`/posts/${id}`, 'DELETE'),
  publishPost: (id: string) => request<any>(`/posts/${id}/publish`, 'POST'),
  generate: (payload: any) => request<any>('/ai/generate', 'POST', payload),
  // OAuth
  oauthAuthorize: (platform: string) => request<{ url: string }>(`/oauth/${platform}/authorize`, 'POST'),
  oauthStatus: () => request<Record<string, any>>('/oauth/status'),
  oauthDisconnect: (platform: string) => request<{ ok: boolean }>(`/oauth/${platform}/disconnect`, 'POST'),
  savePlatformCredentials: (platform: string, creds: { clientId: string; clientSecret: string; extra?: any }) =>
    request<{ ok: boolean }>(`/oauth/${platform}/credentials`, 'PUT', creds),
  oauthAutoConfigure: (platform: string) =>
    request<{ channel: any; credentials: any }>(`/oauth/${platform}/auto-configure`, 'POST'),
};
