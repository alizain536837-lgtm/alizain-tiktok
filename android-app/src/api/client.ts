import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResult, ChatMessage, CommentItem, Conversation, CreatorStats, FeedPage, NotificationItem, SoundItem, User, VideoItem } from './types';

// expo-secure-store has no web implementation — on web its methods throw and
// the app dies before first render (blank white page). Tokens live in
// SecureStore on iOS/Android and in AsyncStorage on web.
const tokenStore = Platform.OS === 'web'
  ? {
      setItemAsync: (k: string, v: string) => AsyncStorage.setItem(k, v),
      getItemAsync: (k: string) => AsyncStorage.getItem(k),
      deleteItemAsync: (k: string) => AsyncStorage.removeItem(k),
    }
  : SecureStore;

export const API_URL: string =
  (Constants.expoConfig?.extra as any)?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://YOUR-API-URL';
export const isApiConfigured = () => !API_URL.includes('YOUR-API-URL');

const ACCESS_KEY = 'alizain_access_token';
const REFRESH_KEY = 'alizain_refresh_token';
const USER_KEY = 'alizain_user';

export async function saveTokens(access: string, refresh: string) {
  await tokenStore.setItemAsync(ACCESS_KEY, access);
  await tokenStore.setItemAsync(REFRESH_KEY, refresh);
}
export async function getAccessToken() { return tokenStore.getItemAsync(ACCESS_KEY); }
export async function getRefreshToken() { return tokenStore.getItemAsync(REFRESH_KEY); }
export async function clearTokens() {
  await tokenStore.deleteItemAsync(ACCESS_KEY).catch(() => {});
  await tokenStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
  await AsyncStorage.removeItem(USER_KEY).catch(() => {});
}
export async function saveUser(u: User) { await AsyncStorage.setItem(USER_KEY, JSON.stringify(u)); }
export async function getCachedUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as User) : null;
}

class ApiClient {
  http: AxiosInstance;
  private refreshing: Promise<string | null> | null = null;
  constructor() {
    this.http = axios.create({ baseURL: API_URL, timeout: 30000 });
    this.http.interceptors.request.use(async (cfg) => {
      const t = await getAccessToken();
      if (t) cfg.headers.Authorization = `Bearer ${t}`;
      return cfg;
    });
    this.http.interceptors.response.use(
      (r) => r,
      async (err) => {
        const orig = err.config as AxiosRequestConfig & { _retried?: boolean };
        if (err.response?.status === 401 && !orig._retried && !orig.url?.includes('/auth/refresh')) {
          orig._retried = true;
          const token = await this.refreshAccessToken();
          if (token) { orig.headers = { ...(orig.headers || {}), Authorization: `Bearer ${token}` }; return this.http(orig); }
          await clearTokens();
        }
        return Promise.reject(err);
      },
    );
  }
  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const rt = await getRefreshToken(); if (!rt) return null;
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken: rt });
          const data = res.data?.data || res.data;
          if (data?.accessToken) { await tokenStore.setItemAsync(ACCESS_KEY, data.accessToken); if (data.refreshToken) await tokenStore.setItemAsync(REFRESH_KEY, data.refreshToken); return data.accessToken as string; }
          return null;
        } catch { return null; } finally { this.refreshing = null; }
      })();
    }
    return this.refreshing;
  }
  private unwrap<T>(res: any): T { return (res.data?.data ?? res.data) as T; }
  private err(e: any): Error { return new Error(e?.response?.data?.error || e?.message || 'Request failed'); }

  // ---- health / misc ----
  async health() { try { const r = await this.http.get('/health'); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async liveAvailability() { try { const r = await this.http.get('/api/live/availability'); return this.unwrap<{ available: boolean; reason?: string }>(r); } catch (e) { throw this.err(e); } }

  // ---- auth ----
  async register(p: { username: string; email: string; password: string; displayName: string }) { try { const r = await this.http.post('/api/auth/register', p); const d = this.unwrap<AuthResult>(r); await saveTokens(d.accessToken, d.refreshToken); await saveUser(d.user); return d; } catch (e) { throw this.err(e); } }
  async login(p: { identifier: string; password: string }) { try { const r = await this.http.post('/api/auth/login', p); const d = this.unwrap<AuthResult>(r); await saveTokens(d.accessToken, d.refreshToken); await saveUser(d.user); return d; } catch (e) { throw this.err(e); } }
  async logout() { try { await this.http.post('/api/auth/logout'); } catch {} await clearTokens(); }
  async forgotPassword(email: string) { try { const r = await this.http.post('/api/auth/forgot-password', { email }); return this.unwrap<{ resetCode: string }>(r); } catch (e) { throw this.err(e); } }
  async resetPassword(p: { email: string; code: string; newPassword: string }) { try { const r = await this.http.post('/api/auth/reset-password', p); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async me() { try { const r = await this.http.get('/api/auth/me'); const u = this.unwrap<User>(r); await saveUser(u); return u; } catch (e) { throw this.err(e); } }

  // ---- users ----
  async getUser(username: string) { try { const r = await this.http.get(`/api/users/${encodeURIComponent(username)}`); return this.unwrap<User>(r); } catch (e) { throw this.err(e); } }
  async updateMe(p: Partial<User>) { try { const r = await this.http.patch('/api/users/me', p); const u = this.unwrap<User>(r); await saveUser(u); return u; } catch (e) { throw this.err(e); } }
  async getUserVideos(username: string) { try { const r = await this.http.get(`/api/users/${encodeURIComponent(username)}/videos`); return this.unwrap<VideoItem[]>(r); } catch (e) { throw this.err(e); } }
  async getSavedVideos() { try { const r = await this.http.get('/api/users/me/saved'); return this.unwrap<VideoItem[]>(r); } catch (e) { throw this.err(e); } }
  async getFollowers(username: string) { try { const r = await this.http.get(`/api/users/${encodeURIComponent(username)}/followers`); return this.unwrap<User[]>(r); } catch (e) { throw this.err(e); } }
  async getFollowing(username: string) { try { const r = await this.http.get(`/api/users/${encodeURIComponent(username)}/following`); return this.unwrap<User[]>(r); } catch (e) { throw this.err(e); } }
  async follow(id: string) { try { const r = await this.http.post(`/api/users/${id}/follow`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async unfollow(id: string) { try { const r = await this.http.delete(`/api/users/${id}/follow`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async block(id: string) { try { const r = await this.http.post(`/api/users/${id}/block`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async reportUser(id: string, reason: string) { try { const r = await this.http.post(`/api/users/${id}/report`, { reason }); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async searchUsers(q: string) { try { const r = await this.http.get('/api/users/search', { params: { q } }); return this.unwrap<User[]>(r); } catch (e) { throw this.err(e); } }

  // ---- videos ----
  async uploadVideo(p: { videoUri: string; thumbnailUri?: string | null; caption: string; hashtags: string[]; soundId?: string | null; onProgress?: (pct: number) => void }) {
    try {
      const form = new FormData();
      form.append('video', { uri: p.videoUri, name: 'video.mp4', type: 'video/mp4' } as any);
      if (p.thumbnailUri) form.append('thumbnail', { uri: p.thumbnailUri, name: 'thumb.jpg', type: 'image/jpeg' } as any);
      form.append('caption', p.caption);
      form.append('hashtags', JSON.stringify(p.hashtags));
      if (p.soundId) form.append('soundId', p.soundId);
      const r = await this.http.post('/api/videos/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (ev) => { if (ev.total) p.onProgress?.(Math.round((ev.loaded / ev.total) * 100)); } });
      return this.unwrap<VideoItem>(r);
    } catch (e) { throw this.err(e); }
  }
  async getFeed(tab: 'for_you' | 'following', limit = 10, cursor?: string) { try { const r = await this.http.get('/api/videos/feed', { params: { tab, limit, cursor } }); return this.unwrap<FeedPage>(r); } catch (e) { throw this.err(e); } }
  async getVideo(id: string) { try { const r = await this.http.get(`/api/videos/${id}`); return this.unwrap<VideoItem>(r); } catch (e) { throw this.err(e); } }
  async viewVideo(id: string) { try { await this.http.post(`/api/videos/${id}/view`); } catch {} }
  async likeVideo(id: string) { try { const r = await this.http.post(`/api/videos/${id}/like`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async unlikeVideo(id: string) { try { const r = await this.http.delete(`/api/videos/${id}/like`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async saveVideo(id: string) { try { const r = await this.http.post(`/api/videos/${id}/save`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async unsaveVideo(id: string) { try { const r = await this.http.delete(`/api/videos/${id}/save`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async shareVideo(id: string) { try { const r = await this.http.post(`/api/videos/${id}/share`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async getComments(videoId: string) { try { const r = await this.http.get(`/api/videos/${videoId}/comments`); return this.unwrap<CommentItem[]>(r); } catch (e) { throw this.err(e); } }
  async postComment(videoId: string, text: string, parentId?: string) { try { const r = await this.http.post(`/api/videos/${videoId}/comments`, { text, parentId }); return this.unwrap<CommentItem>(r); } catch (e) { throw this.err(e); } }
  async likeComment(id: string) { try { const r = await this.http.post(`/api/comments/${id}/like`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async unlikeComment(id: string) { try { const r = await this.http.delete(`/api/comments/${id}/like`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async deleteComment(id: string) { try { const r = await this.http.delete(`/api/comments/${id}`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async reportVideo(id: string, reason: string) { try { const r = await this.http.post(`/api/videos/${id}/report`, { reason }); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }
  async deleteVideo(id: string) { try { const r = await this.http.delete(`/api/videos/${id}`); return this.unwrap<{ ok: boolean }>(r); } catch (e) { throw this.err(e); } }

  // ---- hashtags ----
  async trendingHashtags() { try { const r = await this.http.get('/api/hashtags/trending'); return this.unwrap<{ tag: string; count: number }[]>(r); } catch (e) { throw this.err(e); } }
  async hashtagVideos(tag: string) { try { const r = await this.http.get(`/api/hashtags/${encodeURIComponent(tag)}/videos`); return this.unwrap<VideoItem[]>(r); } catch (e) { throw this.err(e); } }

  // ---- sounds ----
  async searchSounds(q?: string) { try { const r = await this.http.get('/api/sounds', { params: q ? { q } : {} }); return this.unwrap<SoundItem[]>(r); } catch (e) { throw this.err(e); } }
  async getSound(id: string) { try { const r = await this.http.get(`/api/sounds/${id}`); return this.unwrap<SoundItem>(r); } catch (e) { throw this.err(e); } }
  async getSoundVideos(id: string) { try { const r = await this.http.get(`/api/sounds/${id}/videos`); return this.unwrap<VideoItem[]>(r); } catch (e) { throw this.err(e); } }
  soundStreamUrl(id: string) { return `${API_URL}/api/sounds/${id}/stream`; }

  // ---- conversations / messages ----
  async getConversations() { try { const r = await this.http.get('/api/conversations'); return this.unwrap<Conversation[]>(r); } catch (e) { throw this.err(e); } }
  async createConversation(userId: string) { try { const r = await this.http.post('/api/conversations', { userId }); return this.unwrap<Conversation>(r); } catch (e) { throw this.err(e); } }
  async getMessages(conversationId: string) { try { const r = await this.http.get(`/api/conversations/${conversationId}/messages`); return this.unwrap<ChatMessage[]>(r); } catch (e) { throw this.err(e); } }
  async sendMessage(conversationId: string, text: string) { try { const r = await this.http.post(`/api/conversations/${conversationId}/messages`, { text }); return this.unwrap<ChatMessage>(r); } catch (e) { throw this.err(e); } }
  async markConversationRead(conversationId: string) { try { await this.http.post(`/api/conversations/${conversationId}/read`); } catch {} }

  // ---- notifications ----
  async getNotifications() { try { const r = await this.http.get('/api/notifications'); return this.unwrap<NotificationItem[]>(r); } catch (e) { throw this.err(e); } }
  async markNotificationRead(id: string) { try { await this.http.post(`/api/notifications/${id}/read`); } catch {} }
  async markAllNotificationsRead() { try { await this.http.post('/api/notifications/read-all'); } catch {} }

  // ---- creator ----
  async getCreatorStats() { try { const r = await this.http.get('/api/creator/stats'); return this.unwrap<CreatorStats>(r); } catch (e) { throw this.err(e); } }
}
export const api = new ApiClient();
