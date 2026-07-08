import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import colors from "../lib/colors.json";
import { ArrowLeftIcon as ArrowLeft, ImageIconIcon as ImageIcon, SendIcon as Send, XIcon as X } from "../lib/icons";
import api from "../utils/api";
import {
  encryptData,
} from "../utils/encryption";
import { pickImageBase64, uploadEncryptedMedia } from "../utils/media";
import { showToast } from "../utils/toast";
import { decryptPostsOrReplies } from "../utils/wrencryption";
import PostCard from "./PostCard";
import PostOptionsSheet from "./PostOptionsSheet";

const ThreadBottomSheet = ({
  visible,
  post,
  onClose,
  onAddReply,
  onSheetVisibilityChange,
  allowDelete = false,
  onDeleted,
}) => {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["90%"], []);
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
  const [replyText, setReplyText] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [optionsPost, setOptionsPost] = useState(null);

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
    }
  }, []);

  useEffect(() => {
    (async () => {
      setThreadStack([post]);
      if (post?.postId) {
        const cached = repliesCacheRef.current[post.postId];
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
        feedKeysCache,
        publicKey,
        privateKey,
        cacheFeedKey,
        parentFeedKey: parentPost?.feedKey,
      });
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
        {activePost && (
          <PostCard
            post={activePost}
            allowDelete={allowDelete}
            onDeleted={handleDeletePost}
            onMorePress={setOptionsPost}
          />
        )}
      </View>
    ),
    [activePost, allowDelete, handleDeletePost, handleBack, handleClose, threadStack.length],
  );

  const handleReplyChange = useCallback((text) => {
    setReplyText(text);
  }, []);

  const renderInput = useMemo(
    () => (
      <View className="px-4 pt-3 pb-8 bg-[#121212]">
        <View className="rounded-[26px] bg-[#1B1B1B] border border-white/10 px-4 py-3">
          {imageBase64 && (
            <View className="mb-3 rounded-2xl overflow-hidden relative">
              <Image
                source={{ uri: imageBase64.uri }}
                className="w-full h-44"
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
                <X size={16} color="#fff" />
              </Pressable>
            </View>
          )}

          <View className="flex-row items-end">
            <BottomSheetTextInput
              value={replyText}
              onChangeText={handleReplyChange}
              placeholder="Write an encrypted reply..."
              placeholderTextColor="rgba(255,255,255,.45)"
              multiline
              maxLength={280}
              editable={uploadProgress === null}
              style={{
                flex: 1,
                color: "#fff",
                fontSize: 16,
                minHeight: 50,
                maxHeight: 140,
                paddingTop: 12,
                paddingBottom: 12,
                textAlignVertical: "top",
              }}
            />

            <Pressable
              onPress={handlePickImage}
              disabled={uploadProgress !== null}
              className={`ml-2 mb-1 p-1 rounded-full ${uploadProgress !== null ? "opacity-50" : "active:opacity-75"
                }`}
            >
              <ImageIcon size={22} color="#fff" />
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || submitting || uploadProgress !== null}
              className="ml-2 h-11 w-11 rounded-full items-center justify-center"
              style={{ backgroundColor: canSubmit && uploadProgress === null ? colors.primary : "rgba(255, 255, 255, 0.1)" }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Send size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          <View className="flex-row justify-end mt-2">
            <Text className="text-white/30 text-xs">
              {replyText.length}/280
            </Text>
          </View>
        </View>
      </View>
    ),
    [
      replyText,
      imageBase64,
      canSubmit,
      submitting,
      uploadProgress,
      handlePickImage,
      handleReplyChange,
      handleSubmit,
    ],
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
      enableBlurKeyboardOnGesture={true}
      onClose={handleClose}
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
              allowDelete={allowDelete}
              onDeleted={handleDeletePost}
              onMorePress={setOptionsPost}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderInput} // ← Important
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 180, // Extra space for keyboard + input
          }}
          style={{ flex: 1 }}
        />
      )}
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
    </BottomSheet>
  );
};

export default ThreadBottomSheet;
