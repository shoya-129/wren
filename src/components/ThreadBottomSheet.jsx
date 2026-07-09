import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput
} from "@gorhom/bottom-sheet";
import Svg, { Circle } from "react-native-svg";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  Pressable,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import colors from "../lib/colors.json";
import WrenIcons from "../lib/icons";
import api from "../utils/api";
import {
  encryptData,
} from "../utils/encryption";
import { pickImageBase64, uploadEncryptedMedia } from "../utils/media";
import { showToast } from "../utils/toast";
import { decryptPostsOrReplies } from "../utils/wrencryption";
import PostCard from "./PostCard";
import PostOptionsSheet from "./PostOptionsSheet";

const renderBackdrop = (props) => (
  <BottomSheetBackdrop
    {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    opacity={0.5}
    pressBehavior="close"
  />
);

const ThreadBottomSheet = ({
  visible,
  post,
  onClose,
  onAddReply,
  onSheetVisibilityChange,
  panDownClose = true,
  allowDelete = false,
  onDeleted,
  onExpandReply,
}) => {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["70%", "95%"], []);
  const loadedRepliesRef = useRef(new Set());
  const repliesCacheRef = useRef({});
  const isFetchingRef = useRef(false);
  const lastPostIdRef = useRef(null);
  const insets = useSafeAreaInsets();

  const {
    user,
    privateKey,
    publicKey,
    feedKey,
    addActivity,
  } = useUser();

  const [threadStack, setThreadStack] = useState([post]);
  const [replies, setReplies] = useState(post.replies ?? []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [optionsPost, setOptionsPost] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);

  const getPostId = useCallback(
    (item) => item?.postId ?? item?.replyId ?? item?.id,
    [],
  );

  const activePost = threadStack[threadStack.length - 1];
  const activePostId = getPostId(activePost);
  const canSubmit = (replyText.trim().length > 0 || !!imageBase64) && uploadProgress === null;

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

  const handlePickImage = useCallback(async () => {
    const base64 = await pickImageBase64();
    if (base64) {
      setImageBase64(base64);
      requestAnimationFrame(() => {
        sheetRef.current?.expand();
      });
    }
  }, []);

  useEffect(() => {
    if (!post) return;
    const currentId = post.postId ?? post.replyId ?? post.id;
    if (currentId === lastPostIdRef.current) {
      return;
    }
    lastPostIdRef.current = currentId;

    (async () => {
      setThreadStack([post]);
      if (currentId) {
        const cached = repliesCacheRef.current[currentId];
        const nextReplies = cached ?? post.replies ?? [];
        setReplies(normalizeReplyBasics(nextReplies));
      }
    })();
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
      return decryptPostsOrReplies(items, {
        currentUserUid: user?.uid,
        feedKey,
        publicKey,
        privateKey,
        parentFeedKey: parentPost?.feedKey,
      });
    },
    [
      user?.uid,
      feedKey,
      publicKey,
      privateKey,
    ],
  );
  const fetchReplies = useCallback(
    async (pageNumber = 1, { append = false } = {}) => {
      if (!activePostId || isFetchingRef.current) return;

      isFetchingRef.current = true;
      if (pageNumber === 1) {
        setLoadingReplies(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const limit = 20;
        const res = await api.get(`/posts/${activePostId}/replies`, {
          params: { page: pageNumber, limit },
        });

        const rawReplies = res.data || [];
        const decrypted = await decryptReplies(rawReplies, activePost);
        const normalized = normalizeReplyBasics(decrypted);

        setReplies((prev) => {
          let next;
          if (append) {
            const map = new Map();
            for (const r of prev) map.set(getPostId(r), r);
            for (const r of normalized) {
              map.set(getPostId(r), { ...(map.get(getPostId(r)) || {}), ...r });
            }
            next = Array.from(map.values());
          } else {
            next = normalized;
          }
          repliesCacheRef.current[activePostId] = next;
          return next;
        });

        setHasMore(normalized.length >= limit);
        setPage(pageNumber);
        loadedRepliesRef.current.add(activePostId);
      } catch (e) {
        console.error("Failed to load replies page " + pageNumber, e);
      } finally {
        setLoadingReplies(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [activePostId, activePost, decryptReplies, normalizeReplyBasics, getPostId],
  );

  useEffect(() => {
    if (!activePostId) return;

    isFetchingRef.current = false;
    setPage(1);
    setHasMore(true);
    setIsLoadingMore(false);

    const cached = repliesCacheRef.current[activePostId];
    if (cached) {
      setReplies(cached);
      setHasMore(cached.length >= 20);
      setPage(Math.max(1, Math.ceil(cached.length / 20)));
      return;
    }

    if (activePost?.replies?.length) {
      setReplies([]);
      decryptReplies(activePost.replies, activePost).then((decrypted) => {
        const normalized = normalizeReplyBasics(decrypted);
        repliesCacheRef.current[activePostId] = normalized;
        setReplies(normalized);
        setHasMore(normalized.length >= 20);
      });
      return;
    }

    if (loadedRepliesRef.current.has(activePostId)) {
      setReplies([]);
      setHasMore(false);
      return;
    }

    setReplies([]); // Clear stale replies immediately before fetching from server

    if (!visible) return;

    fetchReplies(1, { append: false });
  }, [visible, activePostId, activePost, decryptReplies, normalizeReplyBasics, fetchReplies]);

  const loadMore = useCallback(() => {
    if (loadingReplies || isLoadingMore || !hasMore || replies.length === 0 || isFetchingRef.current) return;
    fetchReplies(page + 1, { append: true });
  }, [loadingReplies, isLoadingMore, hasMore, page, replies.length, fetchReplies]);

  // Notify visibility changes
  useEffect(() => {
    if (onSheetVisibilityChange) onSheetVisibilityChange(visible);
  }, [visible, onSheetVisibilityChange]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    if (sheetRef.current) sheetRef.current.close();
  }, [onClose]);

  const handleExpandPress = useCallback(() => {
    if (onExpandReply && activePost) {
      onExpandReply(activePost, replyText, imageBase64);
      setReplyText("");
      setImageBase64(null);
      handleClose();
    }
  }, [onExpandReply, activePost, replyText, imageBase64, handleClose]);

  const handleDeletePost = useCallback(
    (deletedPostId) => {
      setOptionsPost(null);

      if (deletedPostId === activePostId) {
        onDeleted?.(deletedPostId);
        handleClose();
        return;
      }

      setReplies((prev) =>
        prev.filter((item) => getPostId(item) !== deletedPostId),
      );
      repliesCacheRef.current[activePostId] = (
        repliesCacheRef.current[activePostId] || []
      ).filter((item) => getPostId(item) !== deletedPostId);
      onDeleted?.(deletedPostId);
    },
    [activePostId, getPostId, handleClose, onDeleted],
  );

  const handleSubmit = useCallback(async () => {
    const plain = replyText.trim();
    const mediaToPost = imageBase64;
    if (!plain && !mediaToPost) return;
    if (!feedKey) {
      showToast("Encryption key missing. Please login again.");
      return;
    }
    if (!activePostId) return;

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const encrypted = plain ? await encryptData(plain, feedKey) : null;
      let encryptedMedia = null;

      if (mediaToPost) {
        encryptedMedia = await uploadEncryptedMedia(
          mediaToPost,
          feedKey,
          setUploadProgress,
        );
      }

      const res = await api.post(`/posts/${activePostId}/comment`, {
        encryptedContent: encrypted,
        encryptedMedia,
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
        media: mediaToPost ? mediaToPost.uri : null, // Store local preview URI
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
      setReplyText("");
      setImageBase64(null);
      setUploadProgress(null);
    } catch (e) {
      console.error("Reply failed", e);
      showToast("Failed to post reply.");
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  }, [
    imageBase64,
    feedKey,
    replyText,
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
      if (visible) sheetRef.current.snapToIndex(0);
      else sheetRef.current.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      handleClose();
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    return () => {
      subscription.remove();
    };
  }, [visible, handleClose]);

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
                <WrenIcons.ArrowLeft size={16} color="#FFFFFF" />
              </Pressable>
            )}
            <Text className="text-white text-lg font-semibold">Replies</Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="p-2 rounded-full bg-white/10 border border-white/20"
          >
            <WrenIcons.X size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        {activePost && (
          <PostCard
            post={activePost}
            allowDelete={allowDelete}
            onDeleted={handleDeletePost}
            onMorePress={setOptionsPost}
          />
        )}
        {loadingReplies && (
          <View className="py-4 items-center justify-center">
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </View>
    ),
    [
      activePost,
      allowDelete,
      handleDeletePost,
      handleBack,
      handleClose,
      threadStack.length,
      loadingReplies,
    ],
  );

  const handleReplyChange = useCallback((text) => {
    setReplyText(text);
  }, []);



  const renderFooter = useMemo(
    () => {
      if (!isLoadingMore) return null;
      return (
        <View className="py-4 items-center justify-center">
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      );
    },
    [isLoadingMore],
  );

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={visible ? 0 : -1}
        snapPoints={snapPoints}
        enablePanDownToClose={panDownClose}
        backgroundStyle={{ backgroundColor: "#121212" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
        backdropComponent={renderBackdrop}
        onClose={handleClose}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
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
              allowDelete={allowDelete}
              onDeleted={handleDeletePost}
              onMorePress={setOptionsPost}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 16,
          }}
          style={{ flex: 1 }}
        />

        <View style={{ paddingBottom: Math.max(8, insets.bottom) }} className="px-4 pt-3 bg-[#121212]">
          <View className={`bg-[#1B1B1B] border border-white/10 px-4 py-2 ${(isMultiline || !!imageBase64) ? "rounded-2xl" : "rounded-full"}`}>
            {imageBase64 && (
              <View className="mb-3 rounded-2xl overflow-hidden relative">
                <Image
                  source={{ uri: imageBase64.uri }}
                  className="w-full h-28"
                  resizeMode="cover"
                />
                {uploadProgress !== null && (
                  <View className="absolute inset-0 bg-black/60 items-center justify-center">
                    <Text
                      style={{ fontFamily: "WrenSemiBold" }}
                      className="text-white text-xs font-semibold"
                    >
                      {uploadProgress}% Uploading...
                    </Text>
                  </View>
                )}
                <Pressable
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 items-center justify-center"
                  onPress={() => setImageBase64(null)}
                  disabled={uploadProgress !== null}
                >
                  <WrenIcons.X size={16} color="#fff" />
                </Pressable>
              </View>
            )}

            <View className="flex-row items-end">
              {onExpandReply && isFocused && (
                <Pressable
                  onPress={handleExpandPress}
                  className="mr-2 mb-1.5 p-1 rounded-full active:opacity-75"
                >
                  <WrenIcons.Maximize2 size={18} color="#fff" />
                </Pressable>
              )}

              <BottomSheetTextInput
                onFocus={() => {
                  setIsFocused(true);
                  requestAnimationFrame(() => {
                    sheetRef.current?.expand();
                  });
                }}
                onBlur={() => setIsFocused(false)}
                value={replyText}
                onChangeText={handleReplyChange}
                placeholder="Write an encrypted reply..."
                placeholderTextColor="rgba(255,255,255,.45)"
                multiline
                maxLength={280}
                editable={uploadProgress === null}
                onContentSizeChange={(e) => {
                  const contentHeight = e.nativeEvent.contentSize.height;
                  setIsMultiline(contentHeight > 36);
                }}
                style={{
                  flex: 1,
                  color: "#fff",
                  fontSize: 15,
                  minHeight: 36,
                  maxHeight: 140,
                  paddingTop: 6,
                  paddingBottom: 6,
                  textAlignVertical: "top",
                }}
              />

              <View className="flex-row items-center gap-2 mb-0.5">
                {isFocused && (
                  <WrenIcons.CharacterProgressRing currentLength={replyText.length} />
                )}

                <Pressable
                  onPress={handlePickImage}
                  disabled={uploadProgress !== null}
                  className={`p-1 rounded-full ${uploadProgress !== null ? "opacity-50" : "active:opacity-75"}`}
                >
                  <WrenIcons.Image size={20} color="#fff" />
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit || submitting || uploadProgress !== null}
                  className="h-8 w-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: canSubmit && uploadProgress === null ? colors.primary : "rgba(255, 255, 255, 0.1)" }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <WrenIcons.Send size={14} color="#fff" />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </BottomSheet>
      <PostOptionsSheet
        visible={!!optionsPost}
        post={optionsPost}
        canDelete={
          allowDelete &&
          (optionsPost?.author?.uid ?? optionsPost?.uid) === user?.uid
        }
        onClose={() => setOptionsPost(null)}
        onDeleted={handleDeletePost}
      />
    </>
  );
};

export default ThreadBottomSheet;
