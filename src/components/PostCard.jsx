import { useRouter } from "expo-router";
import {
  BadgeCheck,
  Lock,
  MessageCircle,
  MoreVertical,
  Repeat2,
  Share2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  UserPlus,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { useUser } from "../context/UserContext";
import api from "../utils/api";
import { getEntityUid, getFollowStatus } from "../utils/followStatus";

const ICON_COLOR = "rgb(255 255 255 / 0.8)";
const ICON_HIT_CLASS =
  "h-8 w-8 items-center justify-center rounded-full overflow-hidden";

const pressedIconStyle = (pressed) =>
  pressed
    ? { backgroundColor: "rgba(255, 255, 255, 0.1)", opacity: 0.75 }
    : undefined;

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
};

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

const PostCard = ({
  post,
  onStatusChange,
  onCommentPress,
  allowDelete = false,

  showMoreActions = true,
  onMorePress,
}) => {
  const router = useRouter();
  const {
    user: currentUser,
    followingStatus,
    updateFollowingStatus,
    addActivity,
    likedPosts,
    dislikedPosts,
    repostedPosts,
    toggleLike,
    toggleDislike,
    toggleRepost,
  } = useUser();

  const [loadingAction, setLoadingAction] = useState(false);
  const formatted = formatDate(post.createdAt);
  const imageUri = getImageUri(post.media);

  const isLiked = !!likedPosts[post.postId];
  const isDisliked = !!dislikedPosts[post.postId];
  const isReposted = !!repostedPosts[post.postId];

  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);

  useEffect(() => {
    const start = async () => {
      setLikesCount(post.likesCount || 0);
      setRepostsCount(post.repostsCount || 0);
    };
    start();
  }, [post.postId, post.likesCount, post.repostsCount]);

  const handleLike = () => {
    const res = toggleLike(post.postId);
    setLikesCount((prev) => (res.liked ? prev + 1 : Math.max(0, prev - 1)));
  };

  const handleDislike = () => {
    const res = toggleDislike(post.postId);
    if (res.disliked && isLiked) {
      setLikesCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleRepost = () => {
    const res = toggleRepost(post.postId);
    setRepostsCount((prev) => res.reposted ? prev + 1 : Math.max(0, prev - 1));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `Check this encrypted post on wren: https://wren.encrypt/post/${post.postId}`,
      });
    } catch (error) {
      console.error("Error sharing post:", error);
    }
  };

  const author = post.author || {};
  const authorId = getEntityUid(post);
  const isOwnPost = authorId === currentUser?.uid;
  const canShowMoreMenu = showMoreActions && !!onMorePress &&
    (!isOwnPost || allowDelete);
  const status = getFollowStatus(
    post,
    followingStatus[authorId] || "none",
    currentUser,
  );
  const isPending = status === "pending";
  const isAccepted = status === "accepted";

  const handleOpenProfile = () => {
    if (!authorId) return;

    if (isOwnPost) {
      router.push("/(tabs)/profile");
      return;
    }

    router.push({
      pathname: "/profile/[username]",
      params: {
        username: author.username || authorId,
        uid: authorId,
      },
    });
  };

  const handleFollowToggle = async () => {
    if (isOwnPost || loadingAction) return;

    const currentStatus = status;
    const nextStatus = currentStatus === "none" ? "pending" : "none";

    setLoadingAction(true);
    updateFollowingStatus(authorId, nextStatus);

    if (nextStatus === "pending") {
      addActivity(
        "follow_request_sent",
        author.username,
        `You requested to follow @${author.username}`,
      );
    } else {
      addActivity(
        "unfollowed",
        author.username,
        `You unfollowed @${author.username}`,
      );
    }

    try {
      const requestPath = currentStatus === "none"
        ? "/user/follow"
        : "/user/unfollow";

      let res;
      try {
        res = await api.post(`${requestPath}/${encodeURIComponent(authorId)}`);
      } catch (e) {
        if (e?.response?.status === 404 && author.username) {
          res = await api.post(
            `${requestPath}/${encodeURIComponent(author.username)}`,
          );
        } else {
          throw e;
        }
      }

      if (currentStatus === "none") {
        const confirmedStatus = res?.data?.follow?.status === "accepted"
          ? "accepted"
          : "pending";
        updateFollowingStatus(authorId, confirmedStatus);
      } else {
        updateFollowingStatus(authorId, "none");
      }

      if (onStatusChange) onStatusChange();
    } catch (e) {
      console.error("Error toggling follow:", e);
      updateFollowingStatus(authorId, currentStatus);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <View className="w-full border-b border-white/10 py-4">
      {/* Header */}
      <View className="h-10 flex-row items-center gap-2 justify-between">
        <Pressable
          onPress={handleOpenProfile}
          className="h-full flex-row items-center gap-2 flex-1"
        >
          {author.avatar
            ? (
              <Image
                source={{ uri: author.avatar }}
                resizeMode="cover"
                className="h-10 w-10 rounded-full bg-white/10"
              />
            )
            : (
              <View className="h-10 w-10 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                <ShieldCheck size={16} color="#4F7DFF" strokeWidth={2} />
              </View>
            )}

          <View className="flex-1 mr-2">
            <View className="items-center flex-row gap-1">
              <Text
                className="text-base font-semibold text-white"
                numberOfLines={1}
              >
                {author.name || author.username || "Wren User"}
              </Text>
              {author.verified && (
                <BadgeCheck size={16} color="#4F7DFF" strokeWidth={2} />
              )}
            </View>
            <Text className="text-xs text-white/60" numberOfLines={1}>
              @{author.username || "anonymous"}
            </Text>
          </View>
        </Pressable>

        {/* Follow / Relationship Button */}
        {!isOwnPost && !isAccepted && (
          <Pressable
            onPress={handleFollowToggle}
            disabled={loadingAction}
            className={`py-1.5 px-3.5 rounded-full flex-row items-center gap-1 ${
              isPending ? "bg-white/10 border border-white/20" : "bg-primary"
            }`}
          >
            {loadingAction
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : (
                <>
                  {isPending
                    ? <UserCheck size={12} color="#A1A1AA" strokeWidth={2.5} />
                    : <UserPlus size={12} color="#FFFFFF" strokeWidth={2.5} />}
                  <Text
                    className={`text-xs ${
                      isPending ? "text-white/40" : "text-white"
                    }`}
                  >
                    {isPending ? "Requested" : "Follow"}
                  </Text>
                </>
              )}
          </Pressable>
        )}

        {canShowMoreMenu
          ? (
            <Pressable
              onPress={() => onMorePress?.(post)}
              className="w-9 h-9 rounded-full items-center justify-center mr-2"
            >
              <MoreVertical size={18} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          )
          : null}
      </View>

      {/* Content */}
      <View className="mt-3 overflow-hidden">
        {post.isDecrypted
          ? (
            <View>
              <Text className="text-[16px] leading-relaxed text-white/80">
                {post.content}
              </Text>
              {imageUri && (
                <View className="mt-3 rounded-2xl overflow-hidden bg-white/5 border border-white/10 max-h-60">
                  <Image
                    source={{ uri: imageUri }}
                    className="w-full h-48"
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>
          )
          : (
            <Pressable className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                <Lock
                  size={16}
                  color="rgba(255, 255, 255, 0.6)"
                  strokeWidth={2}
                />
              </View>
              <View className="flex-1">
                <Text className="text-white/80 text-sm mb-0.5 font-semibold">
                  Secure Content Encrypted
                </Text>
                <Text className="text-white/40 text-xs leading-snug">
                  {isPending
                    ? "Follow request pending. Once accepted, posts will decrypt automatically."
                    : "You must follow this user to decrypt their post feed."}
                </Text>
              </View>
            </Pressable>
          )}
      </View>

      {/* Footer */}
      <View className="mt-3">
        <Text className="text-white/50 text-sm">
          {formatted ? `Wrencrypted on ${formatted}` : ""}
        </Text>

        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-5">
            {/* Comments Icon */}
            <Pressable
              onPress={onCommentPress}
              className="flex-row items-center gap-2"
            >
              {({ pressed }) => (
                <>
                  <View
                    className={ICON_HIT_CLASS}
                    style={pressedIconStyle(pressed)}
                  >
                    <MessageCircle size={18} color={ICON_COLOR} />
                  </View>
                  <Text className="text-white/50 text-xs">
                    {post.repliesCount || 0}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Repost Icon */}
            <Pressable
              onPress={handleRepost}
              className="flex-row items-center gap-2"
            >
              {({ pressed }) => (
                <>
                  <View
                    className={ICON_HIT_CLASS}
                    style={pressedIconStyle(pressed)}
                  >
                    <Repeat2
                      size={20}
                      color={isReposted ? "#10B981" : ICON_COLOR}
                    />
                  </View>
                  <Text
                    className={`text-xs ${
                      isReposted
                        ? "text-emerald-500 font-semibold"
                        : "text-white/50"
                    }`}
                  >
                    {repostsCount}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Share Icon */}
            <Pressable
              onPress={handleShare}
              className={ICON_HIT_CLASS}
              style={({ pressed }) => pressedIconStyle(pressed)}
            >
              <Share2 size={18} color={ICON_COLOR} />
            </Pressable>
          </View>

          {/* Likes section */}
          <View className="flex-row items-stretch gap-3 bg-white/10 px-4 py-2 rounded-full">
            <Pressable
              onPress={handleLike}
              className="flex-row items-center gap-1.5 active:opacity-70"
            >
              <ThumbsUp
                size={18}
                color={isLiked ? "#4F7DFF" : ICON_COLOR}
                fill={isLiked ? "#4F7DFF" : "none"}
              />
              <Text
                className={`text-xs ${
                  isLiked ? "text-primary font-semibold" : "text-white/50"
                }`}
              >
                {likesCount}
              </Text>
            </Pressable>

            <View className="w-px self-stretch bg-white/20" />
            <Pressable
              onPress={handleDislike}
              className="flex-row items-center active:opacity-70"
            >
              <ThumbsDown
                size={18}
                color={isDisliked ? "#EF4444" : ICON_COLOR}
                fill={isDisliked ? "#EF4444" : "none"}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PostCard;
