import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

export async function getCurrentCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  };
}

export async function pickProofImage() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
    const libraryPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (libraryPermission.status !== ImagePicker.PermissionStatus.GRANTED) {
      return null;
    }

    return ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ["images"],
      quality: 0.8
    });
  }

  return ImagePicker.launchCameraAsync({
    allowsEditing: true,
    mediaTypes: ["images"],
    quality: 0.8
  });
}

export async function getExpoPushRegistration() {
  const permission = await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    const platform = process.env.EXPO_OS === "ios" ? "ios" : "android";

    return {
      platform,
      pushToken: token.data
    } as const;
  } catch {
    return null;
  }
}

export async function openMapsDestination(input: {
  latitude: number | null;
  longitude: number | null;
  query: string;
}) {
  const encodedQuery = encodeURIComponent(input.query);
  const hasCoordinates = input.latitude !== null && input.longitude !== null;
  const destination = hasCoordinates
    ? `${input.latitude},${input.longitude}`
    : encodedQuery;
  const url =
    process.env.EXPO_OS === "ios"
      ? `http://maps.apple.com/?daddr=${destination}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  await Linking.openURL(url);
}

export function successHaptic() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
