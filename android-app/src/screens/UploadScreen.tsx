import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { COLORS } from '../theme';
import { Btn } from '../components/ui';
export const MAX_SECONDS = 30;
export default function UploadScreen() {
  const nav = useNavigation<any>(); const [busy, setBusy] = useState(false);
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to pick a video.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: false, quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      // Duration: ImagePicker reports asset.duration in milliseconds;
      // fall back to loading the audio track with expo-av for a precise read.
      let dur = asset.duration ? asset.duration / 1000 : 0;
      if (!dur) {
        const { sound, status } = await Audio.Sound.createAsync({ uri: asset.uri }, {});
        if (status.isLoaded && status.durationMillis) dur = status.durationMillis / 1000;
        await sound.unloadAsync().catch(() => {});
      }      if (dur > MAX_SECONDS) { Alert.alert('Video too long', `This video is ${Math.round(dur)} seconds. Videos must be 30 seconds or less.`); return; }
      nav.navigate('VideoEditor', { videoUri: asset.uri, duration: dur });
    } catch (e: any) { Alert.alert('Could not read video', e.message); }
    finally { setBusy(false); }
  };
  return (<View style={s.wrap}>
    <Text style={s.title}>Create a video</Text>
    <Text style={s.desc}>Pick a video from your library. Maximum length is 30 seconds — longer videos are rejected before upload.</Text>
    <Btn title={busy ? 'Checking…' : 'Pick a Video'} onPress={pick} disabled={busy} />
    <TouchableOpacity onPress={() => nav.navigate('Music')}><Text style={s.link}>Browse Music Library first</Text></TouchableOpacity>
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: 'center' },
  title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold' },
  desc: { color: COLORS.gray, marginTop: 12, lineHeight: 22 },
  link: { color: COLORS.cyan, textAlign: 'center', marginTop: 20 },
});
