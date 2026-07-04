import React, { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { View, FlatList, ActivityIndicator, Alert } from "react-native";
import PostCard from "./PostCard";
import PostOptionsSheet from "./PostOptionsSheet";
import ThreadBottomSheet from "./ThreadBottomSheet";
import api from "../utils/api";
import { decryptData, decryptAsymmetric } from "../utils/encryption";
import { useUser } from "../context/UserContext";

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

const getPostEncryptedFeedKey = (post) => {
  return (
    post?.encryptedFeedKey ??
    post?.follow?.encryptedFeedKey ??
    post?.relationship?.encryptedFeedKey ??
    post?.author?.encryptedFeedKey ??
    null
  );
};

const Feed = ({ onThreadVisibilityChange }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);

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

      const decrypted = await Promise.all(
        filtered.map(async (post) => {
          let postFeedKey = null;
          let content = post.content ?? "";
          let isDecrypted = false;
          let media = post.media ?? null;

          const authorId = post.author?.uid ?? post.uid;
          const encryptedFeedKey = getPostEncryptedFeedKey(post);

          if (authorId && authorId === user?.uid && feedKey) {
            postFeedKey = feedKey;
          } else if (encryptedFeedKey && publicKey && privateKey) {
            try {
              postFeedKey = await decryptAsymmetric(
                encryptedFeedKey,
                publicKey,
                privateKey,
              );
              if (authorId) {
                cacheFeedKey(authorId, postFeedKey);
                updateFollowingStatus(authorId, "accepted");
              }
            } catch (e) {
              console.warn("Failed to decrypt feed key", e);
            }
          } else if (authorId && feedKeysCache[authorId]) {
            postFeedKey = feedKeysCache[authorId];
          }

          if (post.encryptedContent && postFeedKey) {
            try {
              content = await decryptData(post.encryptedContent, postFeedKey);
              isDecrypted = true;
            } catch (e) {
              console.warn("Failed to decrypt post content", e);
            }
          } else if (post.content) {
            isDecrypted = true;
          }

          if (post.encryptedMedia && postFeedKey) {
            try {
              media = await decryptData(post.encryptedMedia, postFeedKey);
            } catch (e) {
              console.warn("Failed to decrypt post media", e);
            }
          }

          return {
            ...post,
            content,
            media,
            isDecrypted,
            feedKey: postFeedKey,
          };
        }),
      );

      setPosts(decrypted);
    } catch (e) {
      console.error("Failed to fetch feed", e);
      Alert.alert("Error", "Failed to load feed. Please try again later.");
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

  useFocusEffect(
    useCallback(() => {
      fetchAndDecrypt();
    }, [fetchAndDecrypt]),
  );

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
            : p,
        ),
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
        <ActivityIndicator size="large" color="#4F7DFF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <FlatList
        data={posts}
        keyExtractor={(item) =>
          item.postId?.toString() ?? Math.random().toString()
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
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
};

export default Feed;
