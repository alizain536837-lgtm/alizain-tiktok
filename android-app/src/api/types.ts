export interface User { id: string; username: string; displayName: string; email?: string; bio?: string; avatarUrl?: string | null; followersCount?: number; followingCount?: number; videosCount?: number; likesCount?: number; isFollowing?: boolean; verified?: boolean; }
export interface VideoItem { id: string; userId: string; username: string; displayName?: string; avatarUrl?: string | null; caption: string; hashtags: string[]; videoUrl: string; thumbnailUrl?: string | null; soundId?: string | null; soundTitle?: string | null; viewsCount: number; likesCount: number; commentsCount: number; sharesCount: number; savesCount?: number; liked?: boolean; saved?: boolean; isFollowing?: boolean; status?: string; createdAt: string; durationSeconds?: number; }
export interface CommentItem { id: string; videoId: string; userId: string; username: string; avatarUrl?: string | null; text: string; likesCount: number; liked?: boolean; replies?: CommentItem[]; createdAt: string; }
export interface SoundItem { id: string; title: string; artist?: string; audioUrl?: string; streamUrl?: string; usesCount?: number; durationSeconds?: number; }
export interface Conversation { id: string; otherUser: User; lastMessage?: string; lastMessageAt?: string; unreadCount?: number; }
export interface ChatMessage { id: string; conversationId: string; senderId: string; senderUsername?: string; text: string; createdAt: string; }
export interface NotificationItem { id: string; type: string; title: string; body?: string; actorUsername?: string; videoId?: string; userId?: string; read: boolean; createdAt: string; }
export interface CreatorStats { totalVideos: number; totalViews: number; totalLikes: number; totalFollowers: number; totalComments?: number; viewsLast7Days?: { date: string; views: number }[]; topVideos?: VideoItem[]; }
export interface FeedPage { videos: VideoItem[]; nextCursor?: string | null; }
export interface AuthResult { accessToken: string; refreshToken: string; user: User; }
