export type RootStackParamList = {
  Splash: undefined; Onboarding: undefined; Login: undefined; SignUp: undefined; ForgotPassword: undefined;
  MainTabs: undefined;
  Profile: { username?: string } | undefined;
  EditProfile: undefined; Notifications: undefined; Comments: { videoId: string } | undefined;
  Messages: undefined; Chat: { conversationId: string; username: string };
  Music: { onPick?: (soundId: string, title: string) => void } | undefined;
  Hashtag: { tag: string }; CreatorDashboard: undefined; Settings: undefined; Privacy: undefined;
  Report: { videoId?: string; userId?: string; username?: string } | undefined;
  Upload: undefined; VideoEditor: { videoUri: string; duration: number };
  Live: undefined; Search: undefined;
};
