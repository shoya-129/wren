import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PostCard from "../../components/PostCard";
import ThreadBottomSheet from "../../components/ThreadBottomSheet";
import { useUser } from "../../context/UserContext";
import api from "../../utils/api";
import { decryptAsymmetric, decryptData } from "../../utils/encryption";

export default function SharedPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    feedKeysCache,
    cacheFeedKey,
    isHydrating,
  } = useUser();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadVisible, setThreadVisible] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const decryptPost = useCallback(
    async (rawPost) => {
      const authorId = rawPost.author?.uid ?? rawPost.uid;
      let postFeedKey = null;
      let content = rawPost.content ?? "";
      let media = rawPost.media ?? null;
      let isDecrypted = false;

      if (authorId && authorId === user?.uid && feedKey) {
        postFeedKey = feedKey;
      } else if (authorId && feedKeysCache[authorId]) {
        postFeedKey = feedKeysCache[authorId];
      } else if (rawPost.encryptedFeedKey && publicKey && privateKey) {
        try {
          postFeedKey = await decryptAsymmetric(
            rawPost.encryptedFeedKey,
            publicKey,
            privateKey,
          );
          if (authorId) cacheFeedKey(authorId, postFeedKey);
        } catch (e) {
          console.warn("Failed to decrypt shared post feed key", e);
        }
      }

      if (rawPost.encryptedContent && postFeedKey) {
        try {
          content = await decryptData(rawPost.encryptedContent, postFeedKey);
          isDecrypted = true;
        } catch (e) {
          console.warn("Failed to decrypt shared post content", e);
        }
      } else if (rawPost.content) {
        isDecrypted = true;
      }

      if (rawPost.encryptedMedia && postFeedKey) {
        try {
          media = await decryptData(rawPost.encryptedMedia, postFeedKey);
        } catch (e) {
          console.warn("Failed to decrypt shared post media", e);
        }
      }

      return {
        ...rawPost,
        content,
        media,
        isDecrypted,
        feedKey: postFeedKey,
      };
    },
    [
      user?.uid,
      feedKey,
      feedKeysCache,
      cacheFeedKey,
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

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F7DFF" />
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
          <PostCard post={post} onCommentPress={() => setThreadVisible(true)} />
          <ThreadBottomSheet
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
