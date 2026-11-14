import { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ALIZAIN TIKTOK',
  slug: 'alizain-tiktok',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'alizain-tiktok',
  userInterfaceStyle: 'dark',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#000000' },
  ios: { supportsTablet: true, bundleIdentifier: 'com.alizain.tiktok' },
  android: { package: 'com.alizain.tiktok', adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#000000' } },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://YOUR-API-URL', eas: { projectId: '00000000-0000-0000-0000-000000000000' } },
  plugins: ['expo-av', 'expo-image-picker'],
});
