import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import type { CommentItem, VideoItem } from '../api/types';
import { COLORS } from '../theme';

export default function CommentSheet({ video, visible, onClose }: { video: VideoItem | null; visible: boolean; onClose: () => void }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  useEffect(() => {
    if (visible && video) { setLoading(true); api.getComments(video.id).then(setComments).catch((e) => Alert.alert('Comments', e.message)).finally(() => setLoading(false)); }
  }, [visible, video]);
  const send = async () => {
    if (!video || !text.trim()) return;
    try { const c = await api.postComment(video.id, text.trim(), replyTo?.id); setComments((p) => [c, ...p]); setText(''); setReplyTo(null); }
    catch (e: any) { Alert.alert('Could not post', e.message); }
  };
  const like = async (c: CommentItem) => {
    try { if (c.liked) { await api.unlikeComment(c.id); } else { await api.likeComment(c.id); }
      setComments((p) => p.map((x) => x.id === c.id ? { ...x, liked: !x.liked, likesCount: x.likesCount + (x.liked ? -1 : 1) } : x));
    } catch {}
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}><View style={styles.sheet}>
        <Text style={styles.title}>Comments {video ? `(${video.commentsCount})` : ''}</Text>
        <TouchableOpacity onPress={onClose} style={styles.close}><Text style={{ color: COLORS.white }}>✕ Close</Text></TouchableOpacity>
        {loading ? <ActivityIndicator color={COLORS.red} /> : comments.length === 0 ? (
          <Text style={styles.empty}>No comments yet — be the first to comment!</Text>
        ) : (
          <FlatList data={comments} keyExtractor={(c) => c.id} style={{ flex: 1 }} renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.user}>@{item.username}</Text><Text style={styles.body}>{item.text}</Text>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => like(item)}><Text style={{ color: item.liked ? COLORS.red : COLORS.gray }}>♥ {item.likesCount}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setReplyTo(item)}><Text style={{ color: COLORS.cyan, marginLeft: 16 }}>Reply</Text></TouchableOpacity>
                </View>
                {(item.replies || []).map((r) => (<Text key={r.id} style={styles.reply}>↳ @{r.username}: {r.text}</Text>))}
              </View>
            </View>
          )} />
        )}
        {replyTo && <Text style={styles.replying}>Replying to @{replyTo.username} — <Text onPress={() => setReplyTo(null)} style={{ color: COLORS.red }}>cancel</Text></Text>}
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Add a comment..." placeholderTextColor={COLORS.muted} />
          <TouchableOpacity style={styles.send} onPress={send}><Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Send</Text></TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, height: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  title: { color: COLORS.white, fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  close: { alignSelf: 'flex-end', marginTop: -20 }, empty: { color: COLORS.gray, textAlign: 'center', marginTop: 40 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  user: { color: COLORS.white, fontWeight: 'bold' }, body: { color: COLORS.white, marginTop: 2 },
  rowActions: { flexDirection: 'row', marginTop: 6 }, reply: { color: COLORS.gray, marginTop: 6, marginLeft: 12 },
  replying: { color: COLORS.gray, marginBottom: 6 },
  inputRow: { flexDirection: 'row', marginTop: 8 },
  input: { flex: 1, backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 20, paddingHorizontal: 14, height: 42 },
  send: { backgroundColor: COLORS.red, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
});
