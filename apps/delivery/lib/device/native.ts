import {
  ActionSheetIOS,
  Alert,
  Linking as NativeLinking,
  Platform
} from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type CoordinatesResult =
  | { coordinates: Coordinates; status: "ok" }
  | {
      canAskAgain?: boolean;
      coordinates: null;
      status: "denied" | "services-disabled" | "unavailable";
    };

export type ProofImageAsset = {
  fileName: string;
  mimeType: "image/jpeg";
  uri: string;
};

export type ProofImageResult =
  | { asset: ProofImageAsset; status: "selected" }
  | { status: "cancelled" }
  | {
      canAskAgain: boolean;
      source: "camera" | "library";
      status: "permission-denied";
    };

const LOCATION_TIMEOUT_MS = 12_000;

export async function getCurrentCoordinates(): Promise<CoordinatesResult> {
  try {
    return await readCurrentCoordinates();
  } catch {
    return { coordinates: null, status: "unavailable" };
  }
}

async function readCurrentCoordinates(): Promise<CoordinatesResult> {
  if (!(await Location.hasServicesEnabledAsync())) {
    return { coordinates: null, status: "services-disabled" };
  }

  let permission = await Location.getForegroundPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (!permission.granted) {
    return {
      canAskAgain: permission.canAskAgain,
      coordinates: null,
      status: "denied"
    };
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60_000,
    requiredAccuracy: 500
  }).catch(() => null);

  try {
    const location = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }),
      LOCATION_TIMEOUT_MS
    );

    return {
      coordinates: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      },
      status: "ok"
    };
  } catch {
    if (lastKnown) {
      return {
        coordinates: {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude
        },
        status: "ok"
      };
    }

    return { coordinates: null, status: "unavailable" };
  }
}

export async function pickProofImage(): Promise<ProofImageResult> {
  const source = await chooseProofSource();

  if (!source) {
    return { status: "cancelled" };
  }

  let permission =
    source === "camera"
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
  }

  if (!permission.granted) {
    return {
      canAskAgain: permission.canAskAgain,
      source,
      status: "permission-denied"
    };
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          cameraType: ImagePicker.CameraType.back,
          mediaTypes: ["images"],
          presentationStyle:
            ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
          quality: 0.9
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          mediaTypes: ["images"],
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          presentationStyle:
            ImagePicker.UIImagePickerPresentationStyle.FORM_SHEET,
          quality: 0.9,
          selectionLimit: 1,
          shouldDownloadFromNetwork: true
        });

  if (result.canceled || !result.assets[0]) {
    return { status: "cancelled" };
  }

  const selected = result.assets[0];
  const converted = await ImageManipulator.manipulateAsync(
    selected.uri,
    selected.width > 1600 ? [{ resize: { width: 1600 } }] : [],
    {
      compress: 0.78,
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  return {
    asset: {
      fileName: `delivery-proof-${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      uri: converted.uri
    },
    status: "selected"
  };
}

export async function getExpoPushRegistration() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    return null;
  }

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true
      }
    });
  }

  if (!permission.granted) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      platform: Platform.OS,
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
  const destination =
    input.latitude !== null && input.longitude !== null
      ? `${input.latitude},${input.longitude}`
      : input.query;
  const encodedDestination = encodeURIComponent(destination);
  const nativeUrl =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;

  return openExternalUrl(nativeUrl);
}

export async function openPhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  return openExternalUrl(`tel:${normalized}`);
}

export function showPermissionSettingsAlert(input: {
  body: string;
  title: string;
}) {
  Alert.alert(input.title, input.body, [
    { style: "cancel", text: "Not now" },
    {
      onPress: () => {
        void NativeLinking.openSettings();
      },
      text: "Open Settings"
    }
  ]);
}

export function successHaptic() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => undefined
  );
}

async function openExternalUrl(url: string) {
  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    throw new Error("This action is not available on this device.");
  }

  await Linking.openURL(url);
}

function chooseProofSource() {
  return new Promise<"camera" | "library" | null>((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ["Take photo", "Choose from Photos", "Cancel"],
          title: "Attach proof of delivery"
        },
        (buttonIndex) => {
          resolve(
            buttonIndex === 0 ? "camera" : buttonIndex === 1 ? "library" : null
          );
        }
      );
      return;
    }

    Alert.alert("Attach proof of delivery", "Choose a proof photo source.", [
      { onPress: () => resolve("camera"), text: "Take photo" },
      { onPress: () => resolve("library"), text: "Choose photo" },
      {
        onPress: () => resolve(null),
        style: "cancel",
        text: "Cancel"
      }
    ]);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Operation timed out.")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
