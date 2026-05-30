import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import axiosInstance from '../services/axiosInstance';

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission, get the Expo push token and register it with the backend.
 * Safe to call on every launch — backend upserts by token. Returns the token
 * or null (e.g. on a simulator or when permission is denied).
 */
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      // Push only works on physical devices.
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ff7f50',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;

    await axiosInstance.post('users/api/push-token/', {
      token,
      platform: Platform.OS,
    });

    return token;
  } catch (err) {
    console.log('Push registration skipped:', err?.message || err);
    return null;
  }
}

/** Unregister this device's token (call on logout). */
export async function unregisterPushToken() {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await axiosInstance.delete('users/api/push-token/', {
      data: { token: tokenResponse.data },
    });
  } catch (err) {
    // best-effort
  }
}
