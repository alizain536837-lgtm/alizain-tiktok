import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { api } from '../api/client';
import type { SoundItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function MusicScreen() {
  const nav = useNavigation<any>(); const route = useRoute<any>();
  const onPick = route.params?.onPick as ((id: string, title: string) => void) | undefined;
  const [sounds, setSounds] = useState<SoundItem[]>([]);
  const [q, setQ] = useState(''); const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const load = async (query?: string) => { try { setSounds(await api.searchSounds(query)); } catch (e: any) { Alert.alert('Music', e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); return () => { soundRef.current?.unloadAsync().catch(() => {}); }; }, []);
  const preview = async (s: SoundItem) => {
    try {
      if (playingId === s.id) { await soundRef.current?.stopAsync(); setPlayingId(null); return; }
      await soundRef.current?.unloadAsync().catch(() => {});
      const { sound } = await Audio.Sound.createAsync({ uri: s.streamUrl || api.soundStreamUrl(s.id) });
      soundRef.current = sound; setPlayingId(s.id); await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlayingId(null); });
    } catch (e: any) { Alert.alert('Preview', e.message); }
  };
  const pick = (s: SoundItem) => {
    if (onPick) { onPick(s.id, s.title); nav.goBack(); }
    else Alert.alert('Sound', `${s.title} — use it from the Video Editor when uploading.`);
  };
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <TextInput style={s.input} placeholder="Search sounds…" placeholderTextColor={COLORS.muted} value={q} onChangeText={(v) => { setQ(v); load(v.trim() || undefined); }} />
    <FlatList data={sounds} keyExtractor={(x) => x.id} ListEmptyComponent={<Empty text="No sounds yet — the music library is empty." />}
      renderItem={({ item }) => (<View style={s.row}><View style={{ flex: 1 }}>
        <Text style={s.title}>{item.title}</Text><Text style={s.sub}>{item.artist || 'Unknown artist'}{item.usesCount ? ` • ${item.usesCount} videos` : ''}</Text></View>
        <TouchableOpacity onPress={() => preview(item)}><Text style={s.act}>{playingId === item.id ? '⏸' : '▶'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => pick(item)}><Text style={s.use}>{onPick ? 'Use' : 'Videos'}</Text></TouchableOpacity>
      </View>)} />
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16, paddingTop: 8 },
  input: { backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { color: COLORS.white, fontWeight: 'bold' }, sub: { color: COLORS.gray, fontSize: 12, marginTop: 2 },
  act: { fontSize: 20, color: COLORS.white, marginHorizontal: 12 }, use: { color: COLORS.cyan, fontWeight: 'bold' },
});
