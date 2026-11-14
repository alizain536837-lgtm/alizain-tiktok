// Native implementation (iOS/Android) using expo-video-thumbnails.
import * as VideoThumbnails from 'expo-video-thumbnails';
export async function getVideoThumbnail(videoUri: string, timeMs: number): Promise<string | null> {
  try {
    const t = await VideoThumbnails.getThumbnailAsync(videoUri, { time: timeMs });
    return t.uri;
  } catch {
    return null;
  }
}
