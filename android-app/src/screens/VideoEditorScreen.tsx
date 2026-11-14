import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getVideoThumbnail } from '../utils/thumbnails';
import { api } from '../api/client';
import { COLORS } from '../theme';
import { Btn, Err } from '../components/ui';
import { MAX_SECONDS } from './UploadScreen';

export default function VideoEditorScreen() {
  const nav = useNavigation<any>(); const route = useRoute<any>();
  const { videoUri, duration } = route.params as { videoUri: string; duration: number };
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState(String(Math.min(duration, MAX_SECONDS)));
  const [soundId, setSoundId] = useState<string | null>(null);
  const [soundTitle, setSoundTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');

  const pickSound = () => nav.navigate('Music', { onPick: (id: string, title: string) => { setSoundId(id); setSoundTitle(title); } });
  const upload = async () => {
    const s = parseFloat(start) || 0; const e = parseFloat(end) || duration;
    if (e - s <= 0 || e - s > MAX_SECONDS) { setErr(`Trim must be 1–${MAX_SECONDS} seconds (you selected ${Math.max(0, e - s).toFixed(1)}s).`); return; }
    if (s < 0 || e > duration) { setErr(`Trim must be within the video (0–${duration.toFixed(1)}s).`); return; }
    setUploading(true); setErr(''); setStatus('Generating thumbnail…');
    try {
      const thumb: string | null = await getVideoThumbnail(videoUri, Math.floor(s * 1000));
      setStatus('Uploading…');
      const hashtags = tags.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
      const video = await api.uploadVideo({ videoUri, thumbnailUri: thumb, caption: caption.trim(), hashtags, soundId, onProgress: setProgress });
      setStatus(video.status ? `Processing: ${video.status}` : 'Ready');
      Alert.alert('Uploaded', 'Your video was uploaded and is being processed.');
      nav.navigate('MainTabs');
    } catch (e: any) { setErr(e.message); setStatus(''); }
    finally { setUploading(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, paddingTop: 56 }}>
    <Text style={s.title}>Edit your video</Text>
    <Text style={s.meta}>Length: {duration.toFixed(1)}s • Max {MAX_SECONDS}s</Text>
    <Text style={s.label}>Trim (seconds)</Text>
    <View style={s.row}><TextInput style={s.small} value={start} onChangeText={setStart} keyboardType="decimal-pad" placeholder="Start" placeholderTextColor={COLORS.muted} />
    <TextInput style={s.small} value={end} onChangeText={setEnd} keyboardType="decimal-pad" placeholder="End" placeholderTextColor={COLORS.muted} /></View>
    <Text style={s.label}>Caption</Text>
    <TextInput style={s.input} value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={COLORS.muted} multiline />
    <Text style={s.label}>Hashtags (space or comma separated)</Text>
    <TextInput style={s.input} value={tags} onChangeText={setTags} placeholder="fun dance pakistan" placeholderTextColor={COLORS.muted} />
    <TouchableOpacity onPress={pickSound}><Text style={s.sound}>{soundTitle ? `♪ ${soundTitle} — tap to change` : '♪ Pick a sound from Music Library'}</Text></TouchableOpacity>
    {uploading && <View style={s.bar}><View style={[s.fill, { width: `${progress}%` }]} /></View>}
    {status ? <Text style={s.status}>{status}{uploading ? ` — ${progress}%` : ''}</Text> : null}
    <Err text={err} />
    <Btn title={uploading ? 'Uploading…' : 'Upload Video'} onPress={upload} disabled={uploading} />
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' },
  meta: { color: COLORS.gray, marginTop: 6 }, label: { color: COLORS.white, fontWeight: 'bold', marginTop: 18 },
  row: { flexDirection: 'row' },
  small: { flex: 1, backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, height: 48, marginTop: 8, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  input: { backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, minHeight: 48 },
  sound: { color: COLORS.cyan, marginTop: 18 }, bar: { height: 8, backgroundColor: COLORS.surface, borderRadius: 4, marginTop: 18, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: COLORS.red }, status: { color: COLORS.gray, marginTop: 8, textAlign: 'center' },
});
