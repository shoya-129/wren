import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

export async function pickImageBase64() {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need media library permissions to pick an image."
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].base64;
    }
  } catch (error) {
    console.error("Error picking image:", error);
    Alert.alert("Error", "An error occurred while selecting the image.");
  }
  return null;
}
