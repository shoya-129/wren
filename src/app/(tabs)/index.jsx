import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useMemo, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feed from "../../components/Feed";
import SecuritySheet from "../../components/SecuritySheet";
import WrenIsland from "../../components/WrenIsland";
import { useUser } from "../../context/UserContext";
import colors from "../../lib/colors.json";
import WrenIcons, {
  FileTextIcon as FileText,
  LockIcon as Lock,
  PlusIcon as Plus,
  SendIcon as Send,
  ShieldAlertIcon as ShieldAlert,
  ShieldCheckIcon as ShieldCheck,
  UserRoundIcon as UserRound,
  VerifiedIcon as Verified,
  XIcon as X,
} from "../../lib/icons";
import api from "../../utils/api";
import { encryptData } from "../../utils/encryption";
import { pickImageBase64, uploadEncryptedMedia } from "../../utils/media";
import { showToast } from "../../utils/toast";
import * as Notifications from "expo-notifications";
import { ImagesIcon } from "lucide-react-native";

const getImageUri = (media) => {
  if (!media || typeof media !== "string") return null;
  const trimmed = media.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("file://")
  ) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
};

export default function HomeScreen() {
  const { feedKey, addActivity, user } = useUser();
  const [postContent, setPostContent] = useState("");
  const [imageBase64, setImageBase64] = useState(null); // stores { uri, base64 }
  const [uploadProgress, setUploadProgress] = useState(null); // stores progress percentage or null
  const [isSecuring, setIsSecuring] = useState(false);
  const [replyingToPost, setReplyingToPost] = useState(null);

  const securitySheetref = useRef(null);
  const bottomSheetRef = useRef(null);
  const feedRef = useRef(null);
  const pendingPostRef = useRef(null);
  const snapPoints = useMemo(() => ["85%"], []);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const openCompose = () => {
    bottomSheetRef.current?.expand();
  };

  const handlePickImage = async () => {
    const result = await pickImageBase64();
    if (result) {
      setImageBase64(result);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      showToast("Please write some content to share.");
      return;
    }

    if (!feedKey) {
      showToast("Your feed key is missing. Please log in again.");
      return;
    }

    const contentToPost = postContent.trim();
    const mediaToPost = imageBase64;

    const NOTIFICATION_ID = "post-upload-progress";

    const safeDismissNotification = async (id) => {
      try {
        await Notifications.dismissNotificationAsync(id);
      } catch (err) {
        console.warn("safeDismissNotification failed:", err);
      }
    };

    const safeScheduleNotification = async (title, body, identifier) => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
          },
          trigger: null,
          identifier,
        });
      } catch (err) {
        console.warn("safeScheduleNotification failed:", err);
      }
    };

    const updateProgressNotification = async (progressText, dismissFirst = false) => {
      if (dismissFirst) {
        await safeDismissNotification(NOTIFICATION_ID);
      }
      await safeScheduleNotification("Wren Post Upload", progressText, NOTIFICATION_ID);
    };

    // Perform encryption and API call
    (async () => {
      try {
        setUploadProgress(0); // Starts showing progress loader
        await updateProgressNotification("Encrypting content...");

        const encryptedContent = await encryptData(contentToPost, feedKey);
        let encryptedMedia = null;

        if (mediaToPost) {
          let currentPercent = 0;
          let lastNotificationPercent = -20; // Ensure it triggers first time
          encryptedMedia = await uploadEncryptedMedia(
            mediaToPost,
            feedKey,
            async (percent) => {
              let nextPercent;
              if (typeof percent === "function") {
                nextPercent = percent(currentPercent);
              } else {
                nextPercent = percent;
              }
              currentPercent = nextPercent;
              setUploadProgress(nextPercent);
              
              // Only update notification every 20% to prevent queue congestion and crashes
              if (nextPercent - lastNotificationPercent >= 20 || nextPercent === 100) {
                lastNotificationPercent = nextPercent;
                await updateProgressNotification(`Uploading media: ${nextPercent}%`, true);
              }
            },
          );
        }

        const isReply = !!replyingToPost;
        const endpoint = isReply ? `/posts/${replyingToPost.postId}/comment` : "/posts";
        await updateProgressNotification("Publishing secure post...", true);
        const response = await api.post(endpoint, {
          encryptedContent,
          encryptedMedia,
          ...(isReply ? {} : { visibility: "followers" }),
        });

        if (isReply) {
          await addActivity(
            "reply_created",
            replyingToPost?.author?.username ?? "self",
            "You replied to a post",
            { postId: replyingToPost?.postId || response?.data?.postId, senderAvatar: user?.avatar }
          );
        } else {
          await addActivity(
            "post_created",
            "self",
            "You published a secure end-to-end encrypted post",
            { postId: response?.data?.postId, senderAvatar: user?.avatar }
          );
        }

        // Success: Clean up editor states and close bottom sheet
        setPostContent("");
        setImageBase64(null);
        setUploadProgress(null);
        setReplyingToPost(null);
        bottomSheetRef.current?.close();

        // Dismiss progress and show success notification safely
        await safeDismissNotification(NOTIFICATION_ID);
        await safeScheduleNotification(
          "Wren Post",
          isReply ? "Reply published successfully!" : "Post published successfully!",
          "post-upload-success"
        );

        // Hydrate decrypted post locally so it renders immediately without refresh
        const newPostObj = {
          ...(response?.data || {}),
          content: contentToPost,
          media: mediaToPost ? mediaToPost.uri : null,
          isDecrypted: true,
          author: {
            uid: user?.uid,
            username: user?.username,
            name: user?.name,
            avatar: user?.avatar,
            verified: user?.verified,
          },
          likesCount: 0,
          repostsCount: 0,
          repliesCount: 0,
          feedKey: feedKey,
          isReply: isReply,
        };

        pendingPostRef.current = newPostObj;
        setIsSecuring(true);
      } catch (e) {
        console.error("Error creating post/reply:", e);
        showToast("Could not publish your post. Please try again.");
        setUploadProgress(null);

        // Dismiss progress and show error notification safely
        await safeDismissNotification(NOTIFICATION_ID);
        await safeScheduleNotification(
          "Wren Post",
          "Failed to publish post.",
          "post-upload-error"
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
              style={{ backgroundColor: colors.primary }}
              accessibilityRole="button"
              accessibilityLabel="Create post"
            >
              <Plus size={22} color="#FFFFFF" strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        {/* Home Feed */}
        <Feed
          ref={feedRef}
          onReplyPress={(postToReplyTo, initialText, initialImage) => {
            setReplyingToPost(postToReplyTo);
            if (initialText) {
              setPostContent(initialText);
            }
            if (initialImage) {
              setImageBase64(initialImage);
            }
            bottomSheetRef.current?.expand();
          }}
        />

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
          backdropComponent={renderBackdrop}
          onChange={(index) => {
            if (index === -1) {
              setReplyingToPost(null);
              setPostContent("");
              setImageBase64(null);
            }
          }}
        >
          <BottomSheetView className="flex-1 px-6 pt-2 pb-6">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
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
                {replyingToPost ? "Reply" : "Compose Secure Post"}
              </Text>
            </View>

            {/* Parent Post Thread UI */}
            {replyingToPost && (
              <View className="mb-4 px-1">
                <View className="flex-row">
                  {/* Left Column: Avatar + Thread Line */}
                  <View className="items-center mr-3">
                    {replyingToPost.author?.avatar ? (
                      <Image
                        source={{ uri: replyingToPost.author.avatar }}
                        className="w-9 h-9 rounded-full bg-white/10"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                        <UserRound size={20} color={colors.primary} strokeWidth={2.2} />
                      </View>
                    )}
                    {/* The thread line that connects to the composer input below */}
                    <View className="w-[1.5px] bg-white/15 flex-1 min-h-[30px] my-1" />
                  </View>

                  {/* Right Column: Author Name & Content */}
                  <View className="flex-1 pb-1">
                    <View className="flex-row items-center gap-1">
                      <Text
                        style={{ fontFamily: "WrenSemiBold" }}
                        className="text-white text-sm font-semibold"
                      >
                        {replyingToPost.author?.name || replyingToPost.author?.username}
                      </Text>
                      {replyingToPost.author?.verified && (
                        <Verified size={13} />
                      )}
                      <Text
                        style={{ fontFamily: "WrenRegular" }}
                        className="text-white/40 text-xs ml-1"
                      >
                        @{replyingToPost.author?.username}
                      </Text>
                    </View>
                    <Text
                      style={{ fontFamily: "WrenRegular" }}
                      className="text-white/70 text-sm mt-1"
                      numberOfLines={3}
                    >
                      {replyingToPost.content}
                    </Text>
                    {replyingToPost.media && (
                      <Image
                        source={{ uri: getImageUri(replyingToPost.media) }}
                        className="mt-2 rounded-xl h-24 w-40 bg-white/5"
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </View>

                {/* Second row: Current User Avatar next to "Replying to" hint */}
                <View className="flex-row items-center mt-1">
                  <View className="items-center mr-3 w-9">
                    {user?.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        className="w-6 h-6 rounded-full bg-white/10"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-6 h-6 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                        <UserRound size={12} color={colors.primary} strokeWidth={2.2} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={{ fontFamily: "WrenRegular" }}
                    className="text-white/40 text-xs"
                  >
                    Replying to{" "}
                    <Text className="text-primary font-semibold">
                      @{replyingToPost.author?.username}
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Character Limit and Info */}
            <View className="flex-row items-center gap-1.5 mb-4 bg-white/5 p-3 rounded-2xl border border-white/10">
              <ShieldAlert size={14} color={colors.primary} />
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
                placeholder={replyingToPost ? "Write your encrypted reply..." : "What's on your mind? (encryptions active)"}
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline={true}
                maxLength={280}
                editable={uploadProgress === null}
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
                    onPress={() => setImageBase64(null)}
                    disabled={uploadProgress !== null}
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
                  disabled={uploadProgress !== null}
                  className={`flex-row items-center gap-1.5 bg-white/5 px-3.5 py-1.5 rounded-full border border-white/15 ${uploadProgress !== null ? "opacity-50" : "active:opacity-75"
                    }`}
                >
                  <Image size={14} color="#FFFFFF" />
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-xs font-semibold"
                  >
                    {imageBase64 ? "Change Photo" : "Add Photo"}
                  </Text>
                </Pressable>

                <View className="flex-row items-center gap-3">
                  <WrenIcons.CharacterProgressRing currentLength={postContent.length} />
                  <Pressable
                    onPress={handleCreatePost}
                    disabled={!postContent.trim() || uploadProgress !== null}
                    className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${!postContent.trim() || uploadProgress !== null ? "opacity-50" : "active:opacity-85"
                      }`}
                    style={{ backgroundColor: colors.primary }}
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

        {isSecuring && (
          <WrenIsland
            step1Text="Encrypting Post"
            step2Text="Encrypted & Published"
            step1IconLeft={<FileText size={16} color={colors.primary} strokeWidth={2.8} />}
            step1IconRight={<ImagesIcon size={16} color="#10B981" strokeWidth={2.8} />}
            step2Icon={<Lock size={15} color="#10B981" strokeWidth={3} />}
            step1Width={220}
            step2Width={240}
            onComplete={() => {
              if (pendingPostRef.current) {
                if (!pendingPostRef.current.isReply) {
                  feedRef.current?.addPost(pendingPostRef.current);
                }
                pendingPostRef.current = null;
              }
              setIsSecuring(false);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
