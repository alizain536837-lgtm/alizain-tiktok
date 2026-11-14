import type { User, Video, Sound } from "@prisma/client";

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  role: string;
  status: string;
  isPrivate: boolean;
  commentPrivacy: string;
  createdAt: Date;
  updatedAt: Date;
};

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    role: u.role,
    status: u.status,
    isPrivate: u.isPrivate,
    commentPrivacy: u.commentPrivacy,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export type VideoWithRelations = Video & {
  author: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  sound: Pick<Sound, "id" | "title" | "artist"> | null;
  hashtags: { tag: string }[];
  _count: { likes: number; comments: number; savedBy: number };
};

/** Feed / video detail shape, exactly as the clients expect. */
export function serializeVideo(
  v: VideoWithRelations,
  viewer: { likedIds?: Set<string>; savedIds?: Set<string> } = {}
) {
  return {
    id: v.id,
    caption: v.caption,
    videoUrl: v.videoUrl,
    thumbnailUrl: v.thumbnailUrl,
    durationSec: v.durationSec,
    views: v.views,
    likesCount: v._count.likes,
    commentsCount: v._count.comments,
    sharesCount: v.shares,
    createdAt: v.createdAt,
    author: {
      id: v.author.id,
      username: v.author.username,
      displayName: v.author.displayName,
      avatarUrl: v.author.avatarUrl,
    },
    sound: v.sound ? { id: v.sound.id, title: v.sound.title, artist: v.sound.artist } : null,
    hashtags: v.hashtags.map((h) => h.tag),
    isLiked: viewer.likedIds ? viewer.likedIds.has(v.id) : false,
    isSaved: viewer.savedIds ? viewer.savedIds.has(v.id) : false,
  };
}
