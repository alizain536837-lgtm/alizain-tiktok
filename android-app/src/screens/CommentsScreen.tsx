import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import type { CommentItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function CommentsScreen() {
  const route = useRoute<any>(); const videoId = route.params?.videoId as string;
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { if (videoId) api.getComments(videoId).then(setComments).catch((e) => Alert.alert('Comments', e.message)).finally(() => setLoading(false)); }, [videoId]);
  const send = async () => { if (!text.trim()) return; try { const c = await api.postComment(videoId, text.trim()); setComments((p) => [c, ...p]); setText(''); } catch (e: any) { Alert.alert('Could not post', e.message); } };
  const like = async (c: CommentItem) => { try { if (c.liked) await api.unlikeComment(c.id); else await api.likeComment(c.id); setComments((p) => p.map((x) => x.id === c.id ? { ...x, liked: !x.liked, likesCount: x.likesCount + (x.liked ? -1 : 1) } : x)); } catch {} };
  const del = async (c: CommentItem) => { try { await api.deleteComment(c.id); setComments((p) => p.filter((x) => x.id !== c.id)); } catch (e: any) { Alert.alert('Delete', e.message); } };
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <FlatList data={comments} keyExtractor={(c) => c.id} style={{ flex: 1 }} ListEmptyComponent={<Empty text="No comments yet — be the first to comment!" />}
      renderItem={({ item }) => (<View style={s.row}><View style={{ flex: 1 }}>
        <Text style={s.user}>@{item.username}</Text><Text style={s.body}>{item.text}</Text>
        <View style={s.acts}><TouchableOpacity onPress={() => like(item)}><Text style={{ color: item.liked ? COLORS.red : COLORS.gray }}>♥ {item.likesCount}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => del(item)}><Text style={{ color: COLORS.gray, marginLeft: 16 }}>Delete</Text></TouchableOpacity></View>
        {(item.replies || []).map((r) => (<Text key={r.id} style={s.reply}>↳ @{r.username}: {r.text}</Text>))}
      </View></View>)} />
    <View style={s.inputRow}><TextInput style={s.input} value={text} onChangeText={setText} placeholder="Add a comment..." placeholderTextColor={COLORS.muted} />
    <TouchableOpacity style={s.send} onPress={send}><Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Send</Text></TouchableOpacity></View>
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  user: { color: COLORS.white, fontWeight: 'bold' }, body: { color: COLORS.white, marginTop: 2 },
  acts: { flexDirection: 'row', marginTop: 6 }, reply: { color: COLORS.gray, marginTop: 6, marginLeft: 12 },
  inputRow: { flexDirection: 'row', marginTop: 8 },
  input: { flex: 1, backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 20, paddingHorizontal: 14, height: 42 },
  send: { backgroundColor: COLORS.red, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
});
