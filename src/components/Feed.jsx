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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const flatListRef = useRef(null);

  // Pull user and crypto context
  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    updateFollowingStatus,
    isHydrating,
  } = useUser();

  const fetchFeed = useCallback(
    async (pageNumber = 1, { append } = { append: false }) => {
      if (isHydrating) return;

      const limit = 20;
      if (pageNumber === 1) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await api.get("/posts/feed", {
          params: { page: pageNumber, limit },
        });
        const rawPosts = response.data || [];

        const topLevelPosts = rawPosts.filter((p) => !isReplyRecord(p));
        const filtered = user?.uid
          ? topLevelPosts.filter((p) => p.uid !== user.uid)
          : topLevelPosts;

        const decrypted = await decryptPostsOrReplies(filtered, {
          currentUserUid: user?.uid,
          feedKey,
          publicKey,
          privateKey,
          updateFollowingStatus,
        });

        if (append) {
          setPosts((prev) => {
            // Deduplicate by postId
            const map = new Map();
            for (const p of prev) map.set(p.postId, p);
            for (const p of decrypted) map.set(p.postId, { ...(map.get(p.postId) || {}), ...p });
            return Array.from(map.values());
          });
        } else {
          setPosts(decrypted);
        }

        setHasMore(decrypted.length >= limit);
        setPage(pageNumber);

        // Cache author profiles for this batch
        cacheProfiles(decrypted).catch(console.error);
      } catch (e) {
        console.error("Failed to fetch feed", e);
        if (!append) {
          showToast("Failed to load feed. Please try again later.");
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      isHydrating,
      user,
      feedKey,
      privateKey,
      publicKey,
      updateFollowingStatus,
    ],
  );

  useEffect(() => {
    fetchFeed(1, { append: false });
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
    await fetchFeed(1, { append: false });
    setRefreshing(false);
  };

  const loadMore = () => {
    if (loading || isLoadingMore || !hasMore) return;
    fetchFeed(page + 1, { append: true });
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

  if (loading && posts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.postId?.toString() ?? Math.random().toString()}
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
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
