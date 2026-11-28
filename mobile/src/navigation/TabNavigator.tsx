import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import SearchScreen from '../screens/SearchScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import ForumScreen from '../screens/ForumScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FunZoneScreen from '../screens/FunZoneScreen';
import { useTheme } from '../hooks/useTheme';

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, { icon: string; label: string }> = {
  Home: { icon: '🏠', label: 'Home' },
  FunZone: { icon: '🎮', label: 'Fun' },
  Tournaments: { icon: '⚔️', label: 'Arena' },
  Search: { icon: '🔍', label: 'Discover' },
  Schedule: { icon: '📅', label: 'Schedule' },
  Forum: { icon: '💬', label: 'Forum' },
  Profile: { icon: '👤', label: 'Profile' },
};

function AnimatedTabIcon({
  name,
  focused,
  activeColor,
  inactiveColor,
}: {
  name: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, tension: 100, friction: 6 }),
        Animated.spring(translateY, { toValue: -3, useNativeDriver: true, tension: 100, friction: 7 }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 7 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 7 }),
        Animated.timing(dotOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [focused]);

  const { icon } = TAB_ICONS[name] || { icon: '●' };

  return (
    <View style={styles.tabIconWrap}>
      <Animated.Text
        style={[
          styles.tabIcon,
          { transform: [{ scale }, { translateY }] },
        ]}
      >
        {icon}
      </Animated.Text>
      <Animated.View
        style={[
          styles.activeDot,
          {
            backgroundColor: activeColor,
            opacity: dotOpacity,
          },
        ]}
      />
    </View>
  );
}

export default function TabNavigator() {
  const { colors, isLaunch, isChristmas } = useTheme();
  const insets = useSafeAreaInsets();
  const primaryAccent = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : colors.primary;
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <AnimatedTabIcon
            name={route.name}
            focused={focused}
            activeColor={primaryAccent}
            inactiveColor={colors.textDim}
          />
        ),
        tabBarLabel: ({ focused }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[
              styles.tabLabel,
              { color: focused ? primaryAccent : colors.textDim },
              focused && styles.tabLabelActive,
            ]}
          >
            {TAB_ICONS[route.name]?.label || route.name}
          </Text>
        ),
        tabBarHideOnKeyboard: true,
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingBottom: bottomInset,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="FunZone" component={FunZoneScreen} />
      <Tab.Screen name="Tournaments" component={TournamentsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Forum" component={ForumScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  tabBarItem: {
    paddingVertical: 2,
    minWidth: 0,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 30,
  },
  tabIcon: {
    fontSize: 19,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
});
