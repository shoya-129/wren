import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThreadBottomSheet from "../../components/ThreadBottomSheet";
import { useUser } from "../../context/UserContext";
import colors from "../../lib/colors.json";
import { ArrowLeftIcon as ArrowLeft } from "../../lib/icons";
import api from "../../utils/api";
import { decryptPostOrReply } from "../../utils/wrencryption";

export default function SharedPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    isHydrating,
  } = useUser();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadVisible, setThreadVisible] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const decryptPost = useCallback(
    async (rawPost) => {
      return decryptPostOrReply(rawPost, {
        currentUserUid: user?.uid,
        feedKey,
        publicKey,
        privateKey,
      });
    },
    [
      user?.uid,
      feedKey,
      publicKey,
      privateKey,
    ],
  );

  useEffect(() => {
    if (isHydrating || !postId) return;

    let isActive = true;

    const loadPost = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await api.get("/posts/feed", {
          params: { page: 1, limit: 100 },
        });
        const found = (res.data || []).find(
          (item) => String(item.postId) === String(postId),
        );

        if (!found) {
          if (isActive) {
            setPost(null);
            setNotFound(true);
            setThreadVisible(false);
          }
          return;
        }

        const decrypted = await decryptPost(found);
        if (isActive) {
          setPost(decrypted);
          setThreadVisible(true);
        }
      } catch (e) {
        console.error("Failed to load shared post", e);
        if (isActive) setNotFound(true);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadPost();

    return () => {
      isActive = false;
    };
  }, [isHydrating, postId, decryptPost]);

  const handleCloseThread = useCallback(() => {
    setThreadVisible(false);
    router.back();
  }, [router]);




  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center gap-3 border-b border-white/10 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/15"
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-lg font-semibold">Shared Post</Text>
      </View>

      <View className="h-screen w-full items-center justify-center">
        <Pressable
          onPress={() => setThreadVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
        >
          <Text className="text-white font-semibold">Open Post</Text>
        </Pressable>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-base font-semibold mb-2">
            Post unavailable
          </Text>
          <Text className="text-white/50 text-sm text-center">
            This post is not available in your feed yet, or you may not have
            access to decrypt it.
          </Text>
        </View>
      ) : post ? (
        <View className="flex-1 px-4">
          <ThreadBottomSheet
            panDownClose={false}
            visible={threadVisible}
            post={post}
            onClose={handleCloseThread}
            onSheetVisibilityChange={setThreadVisible}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
