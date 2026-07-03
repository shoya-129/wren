import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetView,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { ArrowLeft, X, Send } from "lucide-react-native";
import PostCard from "./PostCard";
import api from "../utils/api";
import {
  decryptAsymmetric,
  decryptData,
  encryptData,
} from "../utils/encryption";
import { useUser } from "../context/UserContext";

const ThreadBottomSheet = ({
  visible,
  post,
  onClose,
  onAddReply,
  onSheetVisibilityChange,
}) => {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["85%"], []);
  const loadedRepliesRef = useRef(new Set());
  const repliesCacheRef = useRef({});
  const insets = useSafeAreaInsets();

  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    feedKeysCache,
    cacheFeedKey,
    addActivity,
  } = useUser();

  const [threadStack, setThreadStack] = useState([post]);
  const [replies, setReplies] = useState(post.replies ?? []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const replyTextRef = useRef("");
  const replyInputRef = useRef(null);

  const getPostId = useCallback(
    (item) => item?.postId ?? item?.replyId ?? item?.id,
    [],
  );

  const activePost = threadStack[threadStack.length - 1];
  const activePostId = getPostId(activePost);

  const normalizeReplyBasics = useCallback(
    (items) => {
      if (!items?.length) return [];
      return items.map((reply) => ({
        ...reply,
        postId: getPostId(reply),
        uid: reply.uid ?? reply.author?.uid,
        likesCount: reply.likesCount ?? 0,
        repostsCount: reply.repostsCount ?? 0,
        repliesCount: reply.repliesCount ?? 0,
      }));
    },
    [getPostId],
  );

  useEffect(() => {
    setThreadStack([post]);
    if (post?.postId) {
      const cached = repliesCacheRef.current[post.postId];
      const nextReplies = cached ?? post.replies ?? [];
      setReplies(normalizeReplyBasics(nextReplies));
    }
  }, [post, normalizeReplyBasics]);

  const handleOpenThread = useCallback(
    (nextPost) => {
      if (!getPostId(nextPost)) return;
      setThreadStack((prev) => [...prev, nextPost]);
    },
    [getPostId],
  );

  const handleBack = useCallback(() => {
    setThreadStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const decryptReplies = useCallback(
    async (items, parentPost) => {
      if (!items?.length) return [];

      return Promise.all(
        items.map(async (reply) => {
          const normalizedPostId = getPostId(reply);
          const authorId = reply.author?.uid ?? reply.uid;
          let activeKey = null;

          if (authorId && authorId === user?.uid && feedKey) {
            activeKey = feedKey;
          } else if (authorId && feedKeysCache[authorId]) {
            activeKey = feedKeysCache[authorId];
          } else if (reply.encryptedFeedKey && publicKey && privateKey) {
            try {
              activeKey = await decryptAsymmetric(
                reply.encryptedFeedKey,
                publicKey,
                privateKey,
              );
              if (authorId) cacheFeedKey(authorId, activeKey);
            } catch (e) {
              console.warn("Failed to decrypt reply feed key", e);
            }
          } else if (parentPost?.feedKey) {
            activeKey = parentPost.feedKey;
          }

          let content = reply.content ?? "";
          let isDecrypted = !!reply.content;
          let media = reply.media ?? null;

          const normalizedReply = {
            ...reply,
            postId: normalizedPostId,
            uid: reply.uid ?? reply.author?.uid,
            likesCount: reply.likesCount ?? 0,
            repostsCount: reply.repostsCount ?? 0,
            repliesCount: reply.repliesCount ?? 0,
          };

          if (reply.encryptedContent && activeKey) {
            try {
              content = await decryptData(reply.encryptedContent, activeKey);
              isDecrypted = true;
            } catch (e) {
              console.warn("Failed to decrypt reply", e);
              isDecrypted = false;
            }
          }

          if (reply.encryptedMedia && activeKey) {
            try {
              media = await decryptData(reply.encryptedMedia, activeKey);
            } catch (e) {
              console.warn("Failed to decrypt reply media", e);
            }
          }

          return {
            ...normalizedReply,
            content,
            media,
            isDecrypted,
            feedKey: activeKey,
          };
        }),
      );
    },
    [
      user?.uid,
      feedKey,
      feedKeysCache,
      cacheFeedKey,
      publicKey,
      privateKey,
      getPostId,
    ],
  );

  useEffect(() => {
    if (!activePostId) return;

    const cached = repliesCacheRef.current[activePostId];
    if (cached) {
      setReplies(cached);
      return;
    }

    if (activePost?.replies?.length) {
      decryptReplies(activePost.replies, activePost).then((decrypted) => {
        repliesCacheRef.current[activePostId] = decrypted;
        setReplies(decrypted);
      });
      return;
    }

    if (loadedRepliesRef.current.has(activePostId)) {
      setReplies([]);
      return;
    }

    if (!visible) return;

    setLoadingReplies(true);
    api
      .get(`/posts/${activePostId}/replies`)
      .then(async (res) => {
        const decrypted = await decryptReplies(res.data || [], activePost);
        repliesCacheRef.current[activePostId] = decrypted;
        loadedRepliesRef.current.add(activePostId);
        setReplies(decrypted);
      })
      .catch((e) => console.error("Failed to load replies", e))
      .finally(() => setLoadingReplies(false));
  }, [visible, activePostId, activePost, decryptReplies]);

  // Notify visibility changes
  useEffect(() => {
    if (onSheetVisibilityChange) onSheetVisibilityChange(visible);
  }, [visible, onSheetVisibilityChange]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    if (sheetRef.current) sheetRef.current.close();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const plain = replyTextRef.current.trim();
    if (!plain) return;
    if (!feedKey) {
      alert("Encryption key missing. Please login again.");
      return;
    }
    if (!activePostId) return;

    setSubmitting(true);
    try {
      const encrypted = await encryptData(plain, feedKey);
      const res = await api.post(`/posts/${activePostId}/comment`, {
        encryptedContent: encrypted,
      });
      const newReply = res.data;
      const hydratedReply = {
        ...newReply,
        postId: getPostId(newReply),
        uid: newReply.uid ?? newReply.author?.uid,
        likesCount: newReply.likesCount ?? 0,
        repostsCount: newReply.repostsCount ?? 0,
        repliesCount: newReply.repliesCount ?? 0,
        content: plain,
        isDecrypted: true,
        feedKey,
      };

      setReplies((prev) => {
        const next = [hydratedReply, ...prev];
        repliesCacheRef.current[activePostId] = next;
        return next;
      });

      if (onAddReply && activePostId === post?.postId) {
        onAddReply(hydratedReply);
      }

      await addActivity(
        "reply_created",
        activePost?.author?.username ?? "self",
        "You replied to a post",
      );
      replyTextRef.current = "";
      replyInputRef.current?.clear();
      setCanSubmit(false);
    } catch (e) {
      console.error("Reply failed", e);
      alert("Failed to post reply.");
    } finally {
      setSubmitting(false);
    }
  }, [
    feedKey,
    activePostId,
    activePost,
    onAddReply,
    addActivity,
    post,
    getPostId,
  ]);

  // Keep bottom sheet in sync with `visible` prop
  useEffect(() => {
    if (sheetRef.current) {
      if (visible) sheetRef.current.expand();
      else sheetRef.current.close();
    }
  }, [visible]);

  const renderHeader = useMemo(
    () => (
      <View className="pb-4">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2">
            {threadStack.length > 1 && (
              <Pressable
                onPress={handleBack}
                className="p-2 rounded-full bg-white/10 border border-white/20"
              >
                <ArrowLeft size={16} color="#FFFFFF" />
              </Pressable>
            )}
            <Text className="text-white text-lg font-semibold">Replies</Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="p-2 rounded-full bg-white/10 border border-white/20"
          >
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        {activePost && <PostCard post={activePost} />}
      </View>
    ),
    [activePost, handleBack, handleClose, threadStack.length],
  );

  const handleReplyChange = useCallback(
    (text) => {
      replyTextRef.current = text;
      const nextCanSubmit = !!text.trim();
      if (nextCanSubmit !== canSubmit) setCanSubmit(nextCanSubmit);
    },
    [canSubmit],
  );

  const renderInput = useMemo(
    () => (
      <View
        className="bg-[#121212] px-3 pt-2 border-t border-white/10"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <View className="flex-row items-center gap-2">
          <View className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2">
            <BottomSheetTextInput
              ref={replyInputRef}
              placeholder="Write a reply…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              maxLength={200}
              onChangeText={handleReplyChange}
              style={{
                color: "#FFF",
                fontSize: 14,
                lineHeight: 18,
                fontFamily: "WrenRegular",
                maxHeight: 90,
              }}
              className="min-h-[36px]"
            />
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !canSubmit}
            className={`h-9 w-10 items-center justify-center rounded-full ${
              submitting || !canSubmit ? "bg-gray-600" : "bg-primary"
            }`}
          >
            <Send size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>
    ),
    [handleReplyChange, handleSubmit, submitting, insets.bottom, canSubmit],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: "#121212" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {loadingReplies ? (
          <BottomSheetView className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#FFFFFF" />
          </BottomSheetView>
        ) : (
          <BottomSheetFlatList
            data={replies}
            keyExtractor={(item) =>
              item.postId?.toString() ??
              item.replyId?.toString() ??
              item.id?.toString() ??
              Math.random().toString()
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onCommentPress={() => handleOpenThread(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            style={{ flex: 1 }}
          />
        )}
        {renderInput}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
};

export default ThreadBottomSheet;
