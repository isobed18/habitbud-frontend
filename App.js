import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Screens
import Register from './Register';
import Login from './Login';
import Home from './Home';
import Profile from './Profile';
import SubmitProof from './SubmitProof';
import Leaderboard from './Leaderboard';
import Conversations from './Conversations';
import Chat from './Chat';

import FriendProfile from './FriendProfile';
import Challenges from './Challenges';
import AddHabit from './AddHabit';
import Notifications from './Notifications';
import Achievements from './Achievements';
import Stats from './Stats';
import Search from './Search';
import Settings from './Settings';
import AvatarStudio from './AvatarStudio';
import { PreferencesProvider } from './utils/preferences';

// Utils & Services
import { getAccessToken } from './utils/auth';
import { navigationRef } from './services/axiosInstance';
import { registerForPushNotifications } from './utils/push';
import * as ExpoNotifications from 'expo-notifications';
import RewardOverlay from './components/RewardOverlay';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Custom Floating Tab Bar
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.bottomBarContainer}>
      <View style={styles.bottomBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          // Special FAB Logic for AddHabitPlaceholder
          if (route.name === 'AddHabitPlaceholder') {
            return (
              <Pressable key={index} style={styles.fab} onPress={onPress}>
                <Ionicons name="add" size={32} color="#fff" />
              </Pressable>
            );
          }

          let iconName;
          if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
          else if (route.name === 'Leaderboard') iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Challenges') iconName = isFocused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'Conversations') iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Profile') iconName = isFocused ? 'person' : 'person-outline';

          return (
            <Pressable
              key={index}
              style={styles.navIcon}
              onPress={onPress}
            >
              <Ionicons
                name={iconName}
                size={24}
                color={isFocused ? '#ff7f50' : '#ccc'}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
      initialRouteName="Home"
    >
      {/* Order: Home (left), Messages, + (add habit), Challenges, Profile */}
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Conversations" component={Conversations} />
      {/* Middle dummy tab for FAB */}
      <Tab.Screen
        name="AddHabitPlaceholder"
        component={View} // Dummy component
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            // Navigate to the Modal Screen defined in Stack
            navigation.navigate('AddHabitModal');
          },
        })}
      />
      <Tab.Screen name="Challenges" component={Challenges} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getAccessToken();
        // Route INSTANTLY off the stored token — never block the UI on the
        // network here. If the token is stale, the first authed request will get
        // a 401 and the axios interceptor calls forceLogout() -> Login. This keeps
        // boot snappy even when the server is slow/unreachable.
        setInitialRoute(token ? 'Main' : 'Login');
        if (token) registerForPushNotifications();
      } catch (error) {
        console.error('Auth check failed:', error);
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Tapping a push notification jumps to the Notifications screen.
  useEffect(() => {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    });
    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff7f50" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PreferencesProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              // Removed invalid 'animation: card' prop. 
              // Native Stack uses strict animation presets.
            }}
          >
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="Login" component={Login} />

            {/* Main Tab Navigator */}
            <Stack.Screen name="Main" component={MainTabs} />

            {/* Modals & Full Screens */}
            <Stack.Screen
              name="SubmitProof"
              component={SubmitProof}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Chat" component={Chat} />

            <Stack.Screen name="FriendProfile" component={FriendProfile} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Notifications" component={Notifications} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Achievements" component={Achievements} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Stats" component={Stats} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Leaderboard" component={Leaderboard} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Search" component={Search} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Settings" component={Settings} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AvatarStudio" component={AvatarStudio} options={{ animation: 'slide_from_bottom' }} />

            <Stack.Screen
              name="AddHabitModal"
              component={AddHabit}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom'
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <RewardOverlay />
      </SafeAreaProvider>
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bottomBarContainer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center', pointerEvents: 'box-none' },
  bottomBar: { flexDirection: 'row', width: width * 0.85, height: 70, backgroundColor: '#fff', borderRadius: 35, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  navIcon: { padding: 10 },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff7f50', alignItems: 'center', justifyContent: 'center', marginBottom: 30, shadowColor: '#ff7f50', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
});
