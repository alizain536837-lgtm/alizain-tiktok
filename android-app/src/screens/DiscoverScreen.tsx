import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import type { VideoItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function DiscoverScreen() {
  const nav = useNavigation<any>();
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [q, setQ] = useState(''); const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.trendingHashtags().then(setTags).catch((e) => Alert.alert('Discover', e.message)).finally(() => setLoading(false)); }, []);
  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) { setUsers([]); return; }
    try { setUsers(await api.searchUsers(text.trim())); } catch {}
  };
  if (loading) return <Loading />;
  return (
    <View style={s.wrap}>
      <TextInput style={s.input} placeholder="Search users…" placeholderTextColor={COLORS.muted} value={q} onChangeText={search} />
      {q.trim().length >= 2 ? (
        users.length === 0 ? <Empty text="No users found for that search." /> : (
          <FlatList data={users} keyExtractor={(u) => u.id} renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => nav.navigate('Profile', { username: item.username })}>
              <View style={s.av}><Text style={s.avTxt}>{(item.displayName || item.username)[0].toUpperCase()}</Text></View>
              <View><Text style={s.name}>{item.displayName}</Text><Text style={s.sub}>@{item.username}</Text></View>
            </TouchableOpacity>)} />
        )
      ) : (
        <FlatList data={tags} keyExtractor={(t) => t.tag} ListEmptyComponent={<Empty text="No trending hashtags yet — be the first to upload!" />}
          ListHeaderComponent={<Text style={s.h}>Trending hashtags</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => nav.navigate('Hashtag', { tag: item.tag.replace(/^#/, '') })}>
              <Text style={s.hash}>#</Text><View><Text style={s.name}>#{item.tag.replace(/^#/, '')}</Text><Text style={s.sub}>{item.count} videos</Text></View>
            </TouchableOpacity>)} />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16, paddingTop: 56 },
  input: { backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: COLORS.border },
  h: { color: COLORS.white, fontSize: 20, fontWeight: 'bold', marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hash: { color: COLORS.cyan, fontSize: 24, fontWeight: 'bold', width: 44, textAlign: 'center' },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avTxt: { color: COLORS.white, fontWeight: 'bold', fontSize: 18 },
  name: { color: COLORS.white, fontWeight: 'bold' }, sub: { color: COLORS.gray, fontSize: 12 },
});
