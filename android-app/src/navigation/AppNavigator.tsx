import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../theme';
import type { RootStackParamList } from './types';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import UploadScreen from '../screens/UploadScreen';
import InboxScreen from '../screens/InboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CommentsScreen from '../screens/CommentsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import MusicScreen from '../screens/MusicScreen';
import HashtagScreen from '../screens/HashtagScreen';
import CreatorDashboardScreen from '../screens/CreatorDashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ReportScreen from '../screens/ReportScreen';
import VideoEditorScreen from '../screens/VideoEditorScreen';
import LiveScreen from '../screens/LiveScreen';
import SearchScreen from '../screens/SearchScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const dark = { headerStyle: { backgroundColor: COLORS.bg }, headerTintColor: COLORS.white, headerTitleStyle: { fontWeight: 'bold' as const } };

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: COLORS.border }, tabBarActiveTintColor: COLORS.red, tabBarInactiveTintColor: COLORS.gray }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔍</Text> }} />
      <Tab.Screen name="Create" component={UploadScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>＋</Text> }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📩</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={dark}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
            <Stack.Screen name="Comments" component={CommentsScreen} options={{ title: 'Comments' }} />
            <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
            <Stack.Screen name="Music" component={MusicScreen} options={{ title: 'Music Library' }} />
            <Stack.Screen name="Hashtag" component={HashtagScreen} options={{ title: 'Hashtag' }} />
            <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ title: 'Creator Dashboard' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy Settings' }} />
            <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Report Content' }} />
            <Stack.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload Video' }} />
            <Stack.Screen name="VideoEditor" component={VideoEditorScreen} options={{ title: 'Edit Video' }} />
            <Stack.Screen name="Live" component={LiveScreen} options={{ title: 'Live' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
