/**
 * Typed API client for the ALIZAIN TIKTOK Admin Panel.
 *
 * The admin SPA is served from the SAME Netlify site as the backend
 * function, so it calls the relative path `/api` — no VITE_API_URL needed.
 * Every response uses the envelope { ok: true, ... } / { ok: false, error }.
 * Auth: `Authorization: Bearer <accessToken>`; token kept in localStorage
 * (see auth.tsx) and sent on every admin call.
 */

export interface ApiError extends Error {
  status?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  createdAt?: string;
}

export interface AppUser {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  status?: string;
  suspended?: boolean;
  followersCount?: number;
  videosCount?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface VideoItem {
  id: string;
  title?: string;
  caption?: string;
  username?: string;
  user?: { username?: string; name?: string };
  views?: number;
  likesCount?: number;
  commentsCount?: number;
  createdAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CommentItem {
  id: string;
  body?: string;
  text?: string;
  videoId?: string;
  user?: { username?: string; name?: string };
  createdAt?: string;
  [key: string]: unknown;
}

export interface ReportItem {
  id: string;
  reason?: string;
  status?: string;
  targetType?: string;
  targetId?: string;
  reporter?: { username?: string };
  createdAt?: string;
  note?: string;
  [key: string]: unknown;
}

export interface SoundItem {
  id: string;
  title?: string;
  artist?: string;
  durationSec?: number;
  usesCount?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface HashtagItem {
  tag?: string;
  name?: string;
  count?: number;
  videosCount?: number;
  [key: string]: unknown;
}

export interface CreatorItem {
  id: string;
  username?: string;
  name?: string;
  followersCount?: number;
  followers?: number;
  views?: number;
  totalViews?: number;
  videosCount?: number;
  [key: string]: unknown;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AppSettings {
  appName?: string;
  maxVideoSeconds?: number;
  registrationOpen?: boolean;
  maintenanceNote?: string;
  [key: string]: unknown;
}

export interface StorageInfo {
  provider: 'local' | 'cloudinary';
  videosBytes?: number;
  totalBytes?: number;
  videosCount?: number;
  usersCount?: number;
  note?: string;
  [key: string]: unknown;
}

export interface AuditLogItem {
  id: string;
  action?: string;
  adminEmail?: string;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface LiveStream {
  id: string;
  title?: string;
  username?: string;
  status?: string;
  viewers?: number;
  startedAt?: string;
  [key: string]: unknown;
}

export interface LiveProvider {
  configured: boolean;
  provider?: string | null;
  [key: string]: unknown;
}

export interface Stats {
  totalUsers?: number;
  totalVideos?: number;
  totalViews?: number;
  totalLikes?: number;
  reportsOpen?: number;
  storageUsedBytes?: number;
  totalComments?: number;
  totalSounds?: number;
  liveNow?: number;
  [key: string]: unknown;
}

const TOKEN_KEY = 'alizain-tiktok-admin-token';
const REFRESH_KEY = 'alizain-tiktok-admin-refresh';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setTokens(access: string, refresh?: string | null): void {
  try {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch { /* storage unavailable (private mode) — session only */ }
}
export function clearTokens(): void {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (e) {
    throw new Error('Network error — could not reach the server. Check your connection and try again.');
  }
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || data.ok === false) {
    const err = new Error((data.error as string) || `Request failed (${res.status})`) as ApiError;
    err.status = res.status;
    throw err;
  }
  return data as unknown as T;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = {
  health: () => get<{ ok: boolean }>('/health'),

  /** First-use Super Admin setup. Backend returns 403 when one already exists. */
  setup: (body: { name: string; email: string; password: string }) =>
    post<{ ok: boolean; admin: AdminUser; accessToken: string; refreshToken?: string }>('/api/admin/setup', body),

  login: (body: { email: string; password: string }) =>
    post<{ ok: boolean; admin: AdminUser; accessToken: string; refreshToken?: string }>('/api/admin/login', body),

  stats: () => get<{ ok: boolean; stats: Stats }>('/api/admin/stats'),

  users: (params: { search?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    const s = q.toString();
    return get<{ ok: boolean; users: AppUser[] }>(`/api/admin/users${s ? `?${s}` : ''}`);
  },
  suspendUser: (id: string, reason?: string) =>
    post<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/suspend`, { reason }),
  restoreUser: (id: string) =>
    post<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/restore`),

  videos: () => get<{ ok: boolean; videos: VideoItem[] }>('/api/admin/videos'),
  deleteVideo: (id: string) => del<{ ok: boolean }>(`/api/admin/videos/${encodeURIComponent(id)}`),

  comments: () => get<{ ok: boolean; comments: CommentItem[] }>('/api/admin/comments'),
  deleteComment: (id: string) => del<{ ok: boolean }>(`/api/admin/comments/${encodeURIComponent(id)}`),

  reports: (status?: string) =>
    get<{ ok: boolean; reports: ReportItem[] }>(`/api/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  reviewReport: (id: string, body: { action: 'dismiss' | 'remove_content' | 'suspend_user'; note?: string }) =>
    post<{ ok: boolean }>(`/api/admin/reports/${encodeURIComponent(id)}/review`, body),

  sounds: () => get<{ ok: boolean; sounds: SoundItem[] }>('/api/admin/sounds'),
  addSound: (form: FormData) =>
    request<{ ok: boolean; sound: SoundItem }>('/api/admin/sounds', { method: 'POST', body: form }),
  deleteSound: (id: string) => del<{ ok: boolean }>(`/api/admin/sounds/${encodeURIComponent(id)}`),

  hashtags: () => get<{ ok: boolean; hashtags: HashtagItem[] }>('/api/admin/hashtags'),
  deleteHashtag: (tag: string) => del<{ ok: boolean }>(`/api/admin/hashtags/${encodeURIComponent(tag)}`),

  creators: () => get<{ ok: boolean; creators: CreatorItem[] }>('/api/admin/creators'),

  announcements: () => get<{ ok: boolean; announcements: AnnouncementItem[] }>('/api/admin/announcements'),
  sendAnnouncement: (body: { title: string; body: string }) =>
    post<{ ok: boolean; announcement: AnnouncementItem }>('/api/admin/announcements', body),

  settings: () => get<{ ok: boolean; settings: AppSettings }>('/api/admin/settings'),
  updateSettings: (body: Partial<AppSettings>) =>
    patch<{ ok: boolean; settings: AppSettings }>('/api/admin/settings', body),

  storage: () => get<{ ok: boolean; storage: StorageInfo }>('/api/admin/storage'),

  auditLogs: () => get<{ ok: boolean; logs: AuditLogItem[] }>('/api/admin/audit-logs'),

  live: () => get<{ ok: boolean; streams: LiveStream[]; provider: LiveProvider }>('/api/admin/live'),
};
