import { showToast } from "./toast";
import * as ImagePicker from "expo-image-picker";
import { encryptMediaBinary } from "./encryption";
import api from "./api";
import { fromByteArray } from "base64-js";

export async function pickImageBase64() {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("We need media library permissions to pick an image.");
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return {
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
      };
    }
  } catch (error) {
    console.error("Error picking image:", error);
    showToast("An error occurred while selecting the image.");
  }
  return null;
}

export async function uploadEncryptedMedia(selectedImage, feedKey, onProgress) {
  try {
    // 1. Encrypt raw media binary using AES-256-GCM
    const encryptedBytes = await encryptMediaBinary(selectedImage.base64, feedKey);

    // 2. Upload raw binary using multipart/form-data with progress callback
    const formData = new FormData();
    formData.append("file", {
      uri: "data:application/octet-stream;base64," + fromByteArray(encryptedBytes),
      name: `wren-${Date.now()}-image.wren`,
      type: "application/octet-stream",
    });

    const response = await api.post("/posts/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const total = progressEvent.total || encryptedBytes.length;
          const percent = Math.round((progressEvent.loaded * 100) / total);
          onProgress((prev) => (prev === null ? percent : Math.max(prev, percent)));
        }
      },
    });

    return response.data.url;
  } catch (error) {
    console.error("Error in uploadEncryptedMedia:", error);
    throw error;
  }
}
