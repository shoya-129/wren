import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { useUser } from "../context/UserContext";
import colors from "../lib/colors.json";
import api from "../utils/api";
import { cacheProfiles } from "../utils/cache";
import { showToast } from "../utils/toast";
import { decryptPostsOrReplies } from "../utils/wrencryption";
import PostCard from "./PostCard";
import PostOptionsSheet from "./PostOptionsSheet";
import ThreadBottomSheet from "./ThreadBottomSheet";

const isReplyRecord = (item) => {
  if (!item) return false;

  return !!(
    item.replyId ||
    item.replyTo ||
    item.commentTo ||
    item.parentId ||
    item.parentPostId ||
    item.parentReplyId ||
    item.rootPostId ||
    item.replyToPostId ||
    item.replyToReplyId ||
    item.type === "reply" ||
    item.kind === "reply" ||
    item.isReply === true
  );
};

const Feed = forwardRef(({ onThreadVisibilityChange }, ref) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);
  const flatListRef = useRef(null);

  // Pull user and crypto context
  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    feedKeysCache,
    cacheFeedKey,
    updateFollowingStatus,
    isHydrating,
  } = useUser();

  const fetchAndDecrypt = useCallback(async () => {
    if (isHydrating) return;

    setLoading(true);
    try {
      const response = await api.get("/posts/feed", {
        params: { page: 1, limit: 20 },
      });
      const rawPosts = response.data || [];

      const topLevelPosts = rawPosts.filter((p) => !isReplyRecord(p));
      const filtered = user?.uid
        ? topLevelPosts.filter((p) => p.uid !== user.uid)
        : topLevelPosts;

      const decrypted = await decryptPostsOrReplies(filtered, {
        currentUserUid: user?.uid,
        feedKey,
        feedKeysCache,
        publicKey,
        privateKey,
        cacheFeedKey,
        updateFollowingStatus,
      });
      setPosts(decrypted);
      setLoading(false);

      cacheProfiles(decrypted).catch(console.error);
    } catch (e) {
      console.error("Failed to fetch feed", e);
      showToast("Failed to load feed. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [
    isHydrating,
    user,
    feedKey,
    privateKey,
    publicKey,
    feedKeysCache,
    cacheFeedKey,
    updateFollowingStatus,
  ]);

  useEffect(() => {
    fetchAndDecrypt();
  }, []);

  useImperativeHandle(ref, () => ({
    addPost(newPost) {
      setPosts((prev) => [newPost, ...prev]);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAndDecrypt();
    setRefreshing(false);
  };

  const openThread = useCallback((post) => {
    setSelectedPost(post);
    setIsSheetVisible(true);
  }, []);

  const closeThread = useCallback(() => {
    setIsSheetVisible(false);
    setSelectedPost(null);
  }, []);

  const handleAddReply = useCallback(
    (newReply) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === selectedPost.postId
            ? { ...p, replies: [newReply, ...(p.replies ?? [])] }
            : p
        )
      );
    },
    [selectedPost],
  );

  const handleSheetVisibilityChange = useCallback(
    (visible) => {
      setIsSheetVisible(visible);
      if (!visible) {
        setSelectedPost(null);
      }
      if (onThreadVisibilityChange) onThreadVisibilityChange(visible);
    },
    [onThreadVisibilityChange],
  );

  const renderItem = ({ item }) => (
    <PostCard
      post={item}
      onCommentPress={() => openThread(item)}
      onMorePress={setOptionsPost}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) =>
          item.postId?.toString() ?? Math.random().toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{
          paddingBottom: 96,
          paddingHorizontal: 16,
          paddingTop: 8,
        }}
      />
      {selectedPost && (
        <ThreadBottomSheet
          visible={isSheetVisible}
          post={selectedPost}
          onClose={closeThread}
          onAddReply={handleAddReply}
          onSheetVisibilityChange={handleSheetVisibilityChange}
        />
      )}
      <PostOptionsSheet
        visible={!!optionsPost}
        post={optionsPost}
        onClose={() => setOptionsPost(null)}
      />
    </View>
  );
});

Feed.displayName = "Feed";

export default Feed;
