import BottomSheet, {
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  Image as ImageIcon,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feed from "../../components/Feed";
import SecuritySheet from "../../components/SecuritySheet";
import { useUser } from "../../context/UserContext";
import api from "../../utils/api";
import { encryptData } from "../../utils/encryption";
import { pickImageBase64 } from "../../utils/media";

export default function HomeScreen() {
  const { feedKey, addActivity } = useUser();
  const [postContent, setPostContent] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const securitySheetref = useRef(null);
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["85%"], []);

  const openCompose = () => {
    bottomSheetRef.current?.expand();
  };

  const handlePickImage = async () => {
    const base64 = await pickImageBase64();
    if (base64) {
      setImageBase64(base64);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      Alert.alert("Empty Post", "Please write some content to share.");
      return;
    }

    if (!feedKey) {
      Alert.alert(
        "Encryption Error",
        "Your feed key is missing. Please log in again.",
      );
      return;
    }

    // Capture values to use in background
    const contentToPost = postContent.trim();
    const mediaToPost = imageBase64;

    // Optimistic success cleanup
    setPostContent("");
    setImageBase64(null);
    bottomSheetRef.current?.close();

    // Perform encryption and API call in background
    (async () => {
      try {
        const encryptedContent = await encryptData(contentToPost, feedKey);
        let encryptedMedia = null;
        if (mediaToPost) {
          encryptedMedia = await encryptData(mediaToPost, feedKey);
        }

        await api.post("/posts", {
          encryptedContent,
          encryptedMedia,
          visibility: "followers",
        });

        await addActivity(
          "post_created",
          "self",
          "You published a secure end-to-end encrypted post",
        );

        setRefreshKey((prev) => prev + 1); // Triggers Feed component reload
      } catch (e) {
        console.error("Error creating post in background:", e);
        Alert.alert(
          "Post Failed",
          "Could not publish your post in the background. Please try again.",
        );
      }
    })();
  };

  const openSecuritySheet = () => {
    securitySheetref.current?.expand();
  };

  const closeSecuritySheet = () => {
    securitySheetref.current?.close();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center py-2 px-6 border-b border-white/10">
          <Text
            style={{ fontFamily: "WrenSemiBold" }}
            className="text-3xl text-white"
          >
            Wren
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => openSecuritySheet()}
              className="flex-row items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10"
            >
              <ShieldCheck size={12} color="#22c55e" />
              <Text
                style={{ fontFamily: "WrenMedium" }}
                className="text-[11px] text-green-500 font-semibold"
              >
                Secured
              </Text>
            </Pressable>
            <Pressable
              onPress={openCompose}
              className="h-10 px-4 rounded-full items-center justify-center active:opacity-80"
              style={{ backgroundColor: "#4F7DFF" }}
              accessibilityRole="button"
              accessibilityLabel="Create post"
            >
              <Plus size={22} color="#FFFFFF" strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        {/* Home Feed */}
        <Feed key={refreshKey} />

        {/* Compose Post Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backgroundStyle={{ backgroundColor: "#121212" }}
          handleIndicatorStyle={{ backgroundColor: "rgba(255, 255, 255, 0.3)" }}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <BottomSheetView className="flex-1 px-6 pt-2 pb-6">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Pressable
                onPress={() => bottomSheetRef.current?.close()}
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20 items-center justify-center active:opacity-75"
              >
                <X size={16} color="#FFFFFF" />
              </Pressable>
              <Text
                style={{ fontFamily: "WrenBold" }}
                className="text-white text-lg flex-1 text-center mr-8"
              >
                Compose Secure Post
              </Text>
            </View>

            {/* Character Limit and Info */}
            <View className="flex-row items-center gap-1.5 mb-4 bg-white/5 p-3 rounded-2xl border border-white/10">
              <ShieldAlert size={14} color="#4F7DFF" />
              <Text
                style={{ fontFamily: "WrenRegular" }}
                className="text-white/40 text-xs flex-1"
              >
                Content is encrypted locally on your device before reaching our
                servers. Only authorized followers can decrypt it.
              </Text>
            </View>

            {/* Compose Text Input */}
            <View className="flex-1 rounded-2xl bg-white/10 border border-white/20 p-4 mb-4">
              <BottomSheetTextInput
                placeholder="What's on your mind? (encryptions active)"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline={true}
                maxLength={280}
                style={{
                  textAlignVertical: "top",
                  fontSize: 16,
                  color: "#FFFFFF",
                }}
                className="flex-1 text-white leading-relaxed"
                value={postContent}
                onChangeText={setPostContent}
              />

              {/* Selected Image Preview */}
              {imageBase64 && (
                <View className="mt-3 relative rounded-xl overflow-hidden bg-white/5 border border-white/10 max-h-36">
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
                    className="w-full h-28"
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => setImageBase64(null)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 items-center justify-center"
                  >
                    <X size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {/* Toolbar inside input card */}
              <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-white/10">
                <Pressable
                  onPress={handlePickImage}
                  className="flex-row items-center gap-1.5 bg-white/5 px-3.5 py-1.5 rounded-full border border-white/15 active:opacity-75"
                >
                  <ImageIcon size={14} color="#FFFFFF" />
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-xs font-semibold"
                  >
                    {imageBase64 ? "Change Photo" : "Add Photo"}
                  </Text>
                </Pressable>

                <View className="flex-row items-center gap-3">
                  <Text className="text-white/30 text-xs">
                    {postContent.length} / 280
                  </Text>
                  <Pressable
                    onPress={handleCreatePost}
                    disabled={!postContent.trim()}
                    className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-primary ${
                      !postContent.trim() ? "opacity-50" : "active:opacity-85"
                    }`}
                  >
                    <Send size={12} color="#FFFFFF" strokeWidth={2} />
                    <Text
                      style={{ fontFamily: "WrenSemiBold" }}
                      className="text-white text-xs font-semibold"
                    >
                      Publish
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </BottomSheetView>
        </BottomSheet>

        <SecuritySheet
          ref={securitySheetref}
          onContinue={closeSecuritySheet}
          panDown={true}
        />
      </View>
    </SafeAreaView>
  );
}
