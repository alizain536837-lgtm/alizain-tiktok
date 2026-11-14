import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Share, Alert } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import type { VideoItem } from '../api/types';
import { COLORS } from '../theme';

const { height, width } = Dimensions.get('window');
export const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);

export default function VideoCard({ item, active, onOpenComments }: { item: VideoItem; active: boolean; onOpenComments: (v: VideoItem) => void }) {
  const nav = useNavigation<any>();
  const ref = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(!!item.liked);
  const [likes, setLikes] = useState(item.likesCount);
  const [saved, setSaved] = useState(!!item.saved);
  const [following, setFollowing] = useState(!!item.isFollowing);
  const [lastTap, setLastTap] = useState(0);
  const viewed = useRef(false);

  useEffect(() => {
    if (active) {
      if (!viewed.current) { viewed.current = true; api.viewVideo(item.id); }
      ref.current?.playAsync().catch(() => {});
    } else { ref.current?.pauseAsync().catch(() => {}); }
  }, [active, item.id]);

  const toggleLike = async () => {
    const next = !liked; setLiked(next); setLikes((c) => c + (next ? 1 : -1));
    try { if (next) await api.likeVideo(item.id); else await api.unlikeVideo(item.id); }
    catch { setLiked(!next); setLikes((c) => c + (next ? -1 : 1)); }
  };
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) { if (!liked) toggleLike(); }
    else setPaused((p) => { ref.current?.[p ? 'playAsync' : 'pauseAsync']().catch(() => {}); return !p; });
    setLastTap(now);
  };
  const onShare = async () => {
    try { await Share.share({ message: `${item.caption} — watch on ALIZAIN TIKTOK` }); await api.shareVideo(item.id); }
    catch (e: any) { Alert.alert('Share failed', e.message); }
  };
  const onSave = async () => {
    const next = !saved; setSaved(next);
    try { if (next) await api.saveVideo(item.id); else await api.unsaveVideo(item.id); } catch { setSaved(!next); }
  };
  const onFollow = async () => {
    const next = !following; setFollowing(next);
    try { if (next) await api.follow(item.userId); else await api.unfollow(item.userId); } catch { setFollowing(!next); }
  };
  const onStatus = (s: AVPlaybackStatus) => { if (s.isLoaded && s.didJustFinish) ref.current?.replayAsync().catch(() => {}); };
  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={1} style={styles.videoWrap} onPress={onTap}>
        <Video ref={ref} source={{ uri: item.videoUrl }} style={styles.video} resizeMode={ResizeMode.COVER} isLooping shouldPlay={active && !paused} onPlaybackStatusUpdate={onStatus} />
        {paused && <View style={styles.paused}><Text style={styles.pausedTxt}>▶ Paused</Text></View>}
      </TouchableOpacity>
      <View style={styles.side}>
        <TouchableOpacity onPress={() => nav.navigate('Profile', { username: item.username })}><View style={styles.avatar}><Text style={styles.avatarTxt}>{(item.displayName || item.username || '?')[0].toUpperCase()}</Text></View></TouchableOpacity>
        <TouchableOpacity style={styles.followBtn} onPress={onFollow}><Text style={styles.followTxt}>{following ? '✓' : '+'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={toggleLike}><Text style={[styles.icon, liked && styles.liked]}>{liked ? '♥' : '♡'}</Text><Text style={styles.count}>{fmt(likes)}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onOpenComments(item)}><Text style={styles.icon}>💬</Text><Text style={styles.count}>{fmt(item.commentsCount)}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onSave}><Text style={[styles.icon, saved && styles.saved]}>{saved ? '★' : '☆'}</Text><Text style={styles.count}>Save</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onShare}><Text style={styles.icon}>↗</Text><Text style={styles.count}>{fmt(item.sharesCount)}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => nav.navigate('Report', { videoId: item.id, username: item.username })}><Text style={styles.icon}>⚑</Text><Text style={styles.count}>Report</Text></TouchableOpacity>
      </View>
      <View style={styles.bottom}>
        <TouchableOpacity onPress={() => nav.navigate('Profile', { username: item.username })}><Text style={styles.user}>@{item.username}</Text></TouchableOpacity>
        <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
        <View style={styles.tags}>{item.hashtags.map((t) => (<TouchableOpacity key={t} onPress={() => nav.navigate('Hashtag', { tag: t.replace(/^#/, '') })}><Text style={styles.tag}>#{t.replace(/^#/, '')} </Text></TouchableOpacity>))}</View>
        <Text style={styles.meta}>👁 {fmt(item.viewsCount)} views{item.soundTitle ? `  •  ♪ ${item.soundTitle}` : ''}{item.status && item.status !== 'ready' ? `  •  ${item.status}` : ''}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { height, width, backgroundColor: COLORS.bg },
  videoWrap: { flex: 1 }, video: { flex: 1 },
  paused: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20 },
  pausedTxt: { color: COLORS.white, fontSize: 16 },
  side: { position: 'absolute', right: 8, bottom: 110, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  avatarTxt: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  followBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginBottom: 14 },
  followTxt: { color: COLORS.white, fontSize: 13, fontWeight: 'bold' },
  action: { alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 30, color: COLORS.white }, liked: { color: COLORS.red }, saved: { color: '#FFC107' },
  count: { color: COLORS.white, fontSize: 12, marginTop: 2 },
  bottom: { position: 'absolute', left: 12, right: 76, bottom: 96 },
  user: { color: COLORS.white, fontWeight: 'bold', fontSize: 17 }, caption: { color: COLORS.white, fontSize: 14, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }, tag: { color: COLORS.cyan, fontWeight: 'bold' },
  meta: { color: COLORS.gray, fontSize: 12, marginTop: 6 },
});
