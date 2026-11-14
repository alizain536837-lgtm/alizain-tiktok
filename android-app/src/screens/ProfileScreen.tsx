import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Dimensions } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/AuthContext';
import type { User, VideoItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading, Btn } from '../components/ui';
const W = Dimensions.get('window').width / 3;
export default function ProfileScreen() {
  const nav = useNavigation<any>(); const route = useRoute<any>(); const { user: me, signOut } = useAuth();
  const username = route.params?.username as string | undefined;
  const isOwn = !username || username === me?.username;
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tab, setTab] = useState<'videos' | 'saved'>('videos');
  const [saved, setSaved] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const name = username || me?.username; if (!name) return;
      const u = await api.getUser(name); setUser(u); setFollowing(!!u.isFollowing);
      setVideos(await api.getUserVideos(name));
      if (isOwn) setSaved(await api.getSavedVideos());
    } catch (e: any) { Alert.alert('Profile', e.message); } finally { setLoading(false); }
  }, [username, me?.username, isOwn]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <Loading />;
  if (!user) return <Empty text="User not found." />;
  const list = tab === 'videos' ? videos : saved;
  const toggleFollow = async () => {
    const next = !following; setFollowing(next);
    try { if (next) await api.follow(user.id); else await api.unfollow(user.id); } catch { setFollowing(!next); }
  };
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={s.av}><Text style={s.avTxt}>{(user.displayName || user.username)[0].toUpperCase()}</Text></View>
        <Text style={s.name}>{user.displayName}</Text><Text style={s.sub}>@{user.username}</Text>
        {user.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
        <View style={s.stats}>
          <View style={s.stat}><Text style={s.num}>{user.followingCount ?? 0}</Text><Text style={s.lbl}>Following</Text></View>
          <View style={s.stat}><Text style={s.num}>{user.followersCount ?? 0}</Text><Text style={s.lbl}>Followers</Text></View>
          <View style={s.stat}><Text style={s.num}>{user.likesCount ?? 0}</Text><Text style={s.lbl}>Likes</Text></View>
        </View>
        {isOwn ? (
          <View style={s.btnRow}>
            <View style={{ flex: 1, marginRight: 6 }}><Btn title="Edit Profile" onPress={() => nav.navigate('EditProfile')} color={COLORS.surface} /></View>
            <View style={{ flex: 1, marginLeft: 6 }}><Btn title="Creator Dashboard" onPress={() => nav.navigate('CreatorDashboard')} color={COLORS.cyan} /></View>
          </View>
        ) : (
          <View style={s.btnRow}>
            <View style={{ flex: 1, marginRight: 6 }}><Btn title={following ? 'Following' : 'Follow'} onPress={toggleFollow} /></View>
            <View style={{ flex: 1, marginLeft: 6 }}><Btn title="Message" color={COLORS.surface} onPress={async () => { try { const c = await api.createConversation(user.id); nav.navigate('Chat', { conversationId: c.id, username: user.username }); } catch (e: any) { Alert.alert('Message', e.message); } }} /></View>
          </View>
        )}
        {isOwn && <TouchableOpacity onPress={() => nav.navigate('Settings')}><Text style={s.link}>Settings • Privacy • Log out</Text></TouchableOpacity>}
        {!isOwn && <TouchableOpacity onPress={() => nav.navigate('Report', { userId: user.id, username: user.username })}><Text style={s.link}>Report this user</Text></TouchableOpacity>}
      </View>
      <View style={s.tabs}>
        <TouchableOpacity onPress={() => setTab('videos')}><Text style={[s.tab, tab === 'videos' && s.tabOn]}>Videos</Text></TouchableOpacity>
        {isOwn && <TouchableOpacity onPress={() => setTab('saved')}><Text style={[s.tab, tab === 'saved' && s.tabOn]}>Saved</Text></TouchableOpacity>}
      </View>
      <FlatList data={list} numColumns={3} keyExtractor={(v) => v.id}
        ListEmptyComponent={<Empty text={tab === 'videos' ? 'No videos yet — be the first to upload!' : 'No saved videos yet.'} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={{ width: W, height: W * 1.4, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => nav.navigate('Comments', { videoId: item.id })}>
            {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: COLORS.white }}>▶ {item.caption.slice(0, 20)}</Text>}
          </TouchableOpacity>)} />
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  head: { alignItems: 'center', padding: 20, paddingTop: 56 },
  av: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: COLORS.white, fontSize: 36, fontWeight: 'bold' },
  name: { color: COLORS.white, fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  sub: { color: COLORS.gray }, bio: { color: COLORS.white, marginTop: 8, textAlign: 'center' },
  stats: { flexDirection: 'row', marginTop: 14 }, stat: { alignItems: 'center', marginHorizontal: 18 },
  num: { color: COLORS.white, fontWeight: 'bold', fontSize: 17 }, lbl: { color: COLORS.gray, fontSize: 12 },
  btnRow: { flexDirection: 'row', width: '100%', marginTop: 6 },
  link: { color: COLORS.cyan, marginTop: 14 },
  tabs: { flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 10 },
  tab: { color: COLORS.gray, fontWeight: 'bold', marginHorizontal: 20 }, tabOn: { color: COLORS.white },
});
