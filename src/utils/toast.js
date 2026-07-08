import { Platform, ToastAndroid, Alert } from "react-native";

export function showToast(message) {
  if (!message) return;
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert("", message);
  }
}
