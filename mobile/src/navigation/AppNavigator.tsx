import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import TabNavigator from './TabNavigator';
import AnimeDetailScreen from '../screens/AnimeDetailScreen';
import FillerGuideScreen from '../screens/FillerGuideScreen';
import FillerLibraryScreen from '../screens/FillerLibraryScreen';
import TrackerScreen from '../screens/TrackerScreen';
import CommunityHubScreen from '../screens/CommunityHubScreen';
import LocalChatsScreen from '../screens/LocalChatsScreen';
import BrowseScreen from '../screens/BrowseScreen';
import DubbedScreen from '../screens/DubbedScreen';
import ThreadListScreen from '../screens/ThreadListScreen';
import ThreadDetailScreen from '../screens/ThreadDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import TournamentCreateScreen from '../screens/TournamentCreateScreen';
import LoginScreen from '../screens/LoginScreen';
import FunZoneScreen from '../screens/FunZoneScreen';
import QuizScreen from '../screens/QuizScreen';
import GamesScreen from '../screens/GamesScreen';
import PollsScreen from '../screens/PollsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import NewsScreen from '../screens/NewsScreen';
import OSTScreen from '../screens/OSTScreen';
import WallpapersScreen from '../screens/WallpapersScreen';
import TVGuideScreen from '../screens/TVGuideScreen';
import ReelsScreen from '../screens/ReelsScreen';
import WatchPartyScreen from '../screens/WatchPartyScreen';
import WatchPartyRoomScreen from '../screens/WatchPartyRoomScreen';
import MangaScreen from '../screens/MangaScreen';
import VibeScreen from '../screens/VibeScreen';
import TasteProfileScreen from '../screens/TasteProfileScreen';
import LiveDubsScreen from '../screens/LiveDubsScreen';
import WordleScreen from '../screens/WordleScreen';
import DailyDubScheduleScreen from '../screens/DailyDubScheduleScreen';
import HindiDubScreen from '../screens/HindiDubScreen';
import UpdateScreen from '../screens/UpdateScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import FriendsScreen from '../screens/FriendsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import HubScreen from '../screens/HubScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import AllFeaturesScreen from '../screens/AllFeaturesScreen';
import EpisodePulseScreen from '../screens/EpisodePulseScreen';
import DiscoverPeopleScreen from '../screens/DiscoverPeopleScreen';
import FollowListScreen from '../screens/FollowListScreen';
import ChannelsScreen from '../screens/ChannelsScreen';
import ChannelDetailScreen from '../screens/ChannelDetailScreen';
import StoriesScreen from '../screens/StoriesScreen';
import WebScreen from '../screens/WebScreen';
import SplashScreen from '../screens/SplashScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="AnimeDetail"
        component={AnimeDetailScreen}
        options={{ title: '', headerTransparent: true }}
      />
      <Stack.Screen
        name="FillerGuide"
        component={FillerGuideScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen name="FillerLibrary" component={FillerLibraryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tracker" component={TrackerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CommunityHub" component={CommunityHubScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LocalChats" component={LocalChatsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Browse"
        component={BrowseScreen}
        options={({ route }) => ({ title: route.params?.title || 'Browse' })}
      />
      <Stack.Screen
        name="Dubbed"
        component={DubbedScreen}
        options={{ title: 'Anime Dubs' }}
      />
      <Stack.Screen
        name="ThreadList"
        component={ThreadListScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || route.params?.animeTitle || 'Threads',
        })}
      />
      <Stack.Screen
        name="ThreadDetail"
        component={ThreadDetailScreen}
        options={({ route }) => ({ title: route.params?.title || 'Thread' })}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="ForumCategory"
        component={ThreadListScreen}
        options={({ route }) => ({ title: route.params.name || route.params.slug })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="Recommendations"
        component={RecommendationsScreen}
        options={{ title: 'Recommendations' }}
      />
      <Stack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen
        name="TournamentCreate"
        component={TournamentCreateScreen}
        options={{ title: 'Create Tournament' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In', presentation: 'modal' }}
      />
      <Stack.Screen name="FunZone" component={FunZoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Quiz" component={QuizScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Games" component={GamesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Polls" component={PollsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="News" component={NewsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OST" component={OSTScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Wallpapers" component={WallpapersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TVGuide" component={TVGuideScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Reels"
        component={ReelsScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen name="WatchParty" component={WatchPartyScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="WatchPartyRoom"
        component={WatchPartyRoomScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen name="Manga" component={MangaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Vibe" component={VibeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="TasteProfile"
        component={TasteProfileScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen name="LiveDubs" component={LiveDubsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Wordle" component={WordleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DailyDubSchedule" component={DailyDubScheduleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HindiDub" component={HindiDubScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Update" component={UpdateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Hub" component={HubScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen name="AllFeatures" component={AllFeaturesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EpisodePulse" component={EpisodePulseScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DiscoverPeople" component={DiscoverPeopleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FollowList" component={FollowListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Channels" component={ChannelsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChannelDetail" component={ChannelDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Web"
        component={WebScreen}
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
