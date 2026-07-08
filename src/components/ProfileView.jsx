import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../context/UserContext";
import colors from "../lib/colors.json";
import {
  ArrowLeftIcon as ArrowLeft,
  BellIcon as Bell,
  LogOutIcon as LogOut,
  ShieldCheckIcon as ShieldCheck,
  UserPlusIcon as UserPlus,
  UserRoundIcon as UserRound,
  UsersIcon as Users,
  VerifiedIcon as Verified
} from "../lib/icons";
import api from "../utils/api";
import { findProfile } from "../utils/cache";
import { getFollowStatus } from "../utils/followStatus";
import { showToast } from "../utils/toast";
import { resolveUserId } from "../utils/users";
import { decryptPostsOrReplies } from "../utils/wrencryption";
import PostCard from "./PostCard";
import PostOptionsSheet from "./PostOptionsSheet";
import ThreadBottomSheet from "./ThreadBottomSheet";
import UserConnectionsSheet from "./UserConnectionsSheet";
import WrencryptionSheet from "./WrencryptionSheet";

const metricValue = (value) => String(value ?? 0);

const ProfileView = ({
  isOwnProfile = false,
  targetUsername = null,
  targetUid = null,
}) => {
  const router = useRouter();
  const {
    user: currentUser,
    logout,
    isHydrating,
    privateKey,
    publicKey,
    feedKey,
    feedKeysCache,
    cacheFeedKey,
    followingStatus,
    updateFollowingStatus,
    addActivity,
    updateUser,
  } = useUser();

  const [loading, setLoading] = useState(() => !(isOwnProfile && currentUser));
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(
    targetUid ?? (isOwnProfile ? (currentUser?.uid ?? null) : null),
  );
  const [profileUser, setProfileUser] = useState(() =>
    isOwnProfile ? currentUser : null
  );
  const [stats, setStats] = useState(() =>
    isOwnProfile
      ? {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
      }
      : null
  );
  const [reachStats, setReachStats] = useState(() =>
    isOwnProfile
      ? {
        potentialAudienceCount: 0,
        publicPostsCount: 0,
        followersOnlyPostsCount: 0,
      }
      : null
  );
  const [securityStats, setSecurityStats] = useState(() =>
    isOwnProfile
      ? {
        feedKeySharedWithCount: 0,
        pendingFollowRequestsCount: 0,
      }
      : null
  );

  const [posts, setPosts] = useState([]);
  const [canViewPosts, setCanViewPosts] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showSecuritySheet, setShowSecuritySheet] = useState(false);
  const [connectionsType, setConnectionsType] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [threadVisible, setThreadVisible] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);

  const activeProfileUser = profileUser || (isOwnProfile ? currentUser : null);

  const decryptPosts = useCallback(
    async (items) => {
      return decryptPostsOrReplies(items, {
        currentUserUid: currentUser?.uid,
        feedKey,
        feedKeysCache,
        publicKey,
        privateKey,
        cacheFeedKey,
        updateFollowingStatus,
      });
    },
    [
      currentUser?.uid,
      feedKey,
      feedKeysCache,
      publicKey,
      privateKey,
      cacheFeedKey,
      updateFollowingStatus,
    ],
  );

  const fetchProfile = useCallback(
    async (showLoading = true) => {
      if (isHydrating) return;
      if (isOwnProfile && !currentUser) return;
      if (!isOwnProfile && !targetUsername && !targetUid) return;
      if (showLoading) setLoading(true);

      try {
        let profileRes;
        let statsRes = null;
        let lookupId = currentUser?.uid;

        const fetchStatsSafely = async (path) => {
          try {
            return await api.get(path);
          } catch (e) {
            if (e?.response?.status === 404 || e?.response?.status === 500) {
              console.warn(`Stats endpoint unavailable for ${path}`);
              return null;
            }
            throw e;
          }
        };

        if (isOwnProfile) {
          profileRes = await api.get("/user/profile");
          statsRes = await fetchStatsSafely("/user/stats");
        } else {
          profileRes = await findProfile(targetUsername);
          if (!profileRes) {
            const resolvedUid = await resolveUserId({
              uid: targetUid,
              username: targetUsername,
            });

            const candidates = [targetUsername, targetUid, resolvedUid]
              .filter(Boolean)
              .filter((value, index, array) => array.indexOf(value) === index);

            let lastError = null;

            for (const candidate of candidates) {
              try {
                const nextProfileRes = await api.get(
                  `/user/profile/${encodeURIComponent(candidate)}`,
                );
                const nextStatsRes = await fetchStatsSafely(
                  `/user/stats/${encodeURIComponent(candidate)}`,
                );
                profileRes = nextProfileRes;
                statsRes = nextStatsRes;
                lookupId = candidate;
                lastError = null;
                break;
              } catch (e) {
                lastError = e;
                const status = e?.response?.status;
                if (status === 404 || status === 500) {
                  console.warn(
                    `Profile lookup failed for ${candidate} with ${status}, trying next identifier.`,
                  );
                  continue;
                }
                throw e;
              }
            }

            if (!profileRes) {
              throw lastError || new Error("Profile not found");
            }
          }
        }

        const profilePayload = profileRes?.data || {};
        const statsPayload = statsRes?.data || {};
        const nextUser = profilePayload.user || statsPayload.user || null;
        const rawPosts = profilePayload.posts || [];
        const decryptedPosts = await decryptPosts(rawPosts);

        setResolvedUserId(nextUser?.uid ?? lookupId);
        setProfileUser(nextUser);

        if (isOwnProfile && nextUser) {
          updateUser((prev) => ({
            ...(prev || {}),
            ...nextUser,
          }));
        }
        setStats(statsPayload.stats || profilePayload.stats || null);
        setReachStats(
          statsPayload.reachStats || profilePayload.reachStats || null,
        );
        setSecurityStats(
          statsPayload.securityStats || profilePayload.securityStats || null,
        );
        setCanViewPosts(profilePayload.canViewPosts !== false);
        setPosts(decryptedPosts);

        if (!isOwnProfile && nextUser?.uid) {
          const followed = rawPosts.some((item) => !!item?.encryptedFeedKey);
          if (followed) updateFollowingStatus(nextUser.uid, "accepted");
        }
      } catch (e) {
        console.error("Failed to load profile", e);
        showToast("Could not load this profile right now.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      isHydrating,
      isOwnProfile,
      targetUid,
      targetUsername,
      currentUser,
      decryptPosts,
      updateFollowingStatus,
      updateUser,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      fetchProfile(true);
    }, [fetchProfile]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const openThread = (post) => {
    setSelectedPost(post);
    setThreadVisible(true);
  };

  const closeThread = () => {
    setThreadVisible(false);
    setSelectedPost(null);
  };

  const handleAddReply = useCallback(
    (newReply) => {
      setPosts((prev) =>
        prev.map((item) =>
          item.postId === selectedPost?.postId
            ? {
              ...item,
              repliesCount: (item.repliesCount || 0) + 1,
              replies: [newReply, ...(item.replies || [])],
            }
            : item
        )
      );
    },
    [selectedPost],
  );

  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((item) => item.postId !== postId));
    setStats((prev) =>
      prev
        ? { ...prev, postsCount: Math.max(0, (prev.postsCount || 0) - 1) }
        : prev
    );
  }, []);

  const profileUid = activeProfileUser?.uid ??
    resolvedUserId ??
    (isOwnProfile ? (currentUser?.uid ?? null) : null);
  const followState = useMemo(() => {
    if (isOwnProfile || !activeProfileUser) return "accepted";
    return getFollowStatus(
      activeProfileUser,
      followingStatus[profileUid] || "none",
      currentUser,
    );
  }, [
    currentUser,
    followingStatus,
    isOwnProfile,
    profileUid,
    activeProfileUser,
  ]);

  const followButton = useMemo(() => {
    if (isOwnProfile) return null;
    if (followState === "accepted") {
      return {
        label: "Following",
        className: "bg-white/10 border border-white/20",
        isDefault: false,
      };
    }
    if (followState === "pending") {
      return {
        label: "Requested",
        className: "bg-white/10 border border-white/20",
        isDefault: false,
      };
    }
    return { label: "Follow", className: "", isDefault: true };
  }, [followState, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (isOwnProfile || !profileUid || followLoading) return;

    const currentStatus = followingStatus[profileUid] || "none";
    const nextStatus = currentStatus === "none" ? "pending" : "none";
    const username = activeProfileUser?.username;

    setFollowLoading(true);
    updateFollowingStatus(profileUid, nextStatus);

    if (nextStatus === "pending") {
      addActivity(
        "follow_request_sent",
        username,
        `You requested to follow @${username}`,
      );
    } else {
      addActivity("unfollowed", username, `You unfollowed @${username}`);
    }

    try {
      const requestPath = currentStatus === "none"
        ? "/user/follow"
        : "/user/unfollow";

      let res;
      try {
        res = await api.post(
          `${requestPath}/${encodeURIComponent(profileUid)}`,
        );
      } catch (e) {
        if (e?.response?.status === 404 && username) {
          res = await api.post(
            `${requestPath}/${encodeURIComponent(username)}`,
          );
        } else {
          throw e;
        }
      }

      if (currentStatus === "none") {
        const confirmedStatus = res?.data?.follow?.status === "accepted"
          ? "accepted"
          : "pending";
        updateFollowingStatus(profileUid, confirmedStatus);
      } else {
        updateFollowingStatus(profileUid, "none");
      }

      fetchProfile(false);
    } catch (e) {
      console.error("Failed to update follow status", e);
      updateFollowingStatus(profileUid, currentStatus);
      showToast(`Could not update @${username}.`);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleConnectionsMutation = useCallback((event) => {
    if (event?.type !== "revoke") return;

    setStats((prev) =>
      prev
        ? {
          ...prev,
          followersCount: Math.max(0, (prev.followersCount || 0) - 1),
        }
        : prev
    );
    setSecurityStats((prev) =>
      prev
        ? {
          ...prev,
          feedKeySharedWithCount: Math.max(
            0,
            (prev.feedKeySharedWithCount || 0) - 1,
          ),
        }
        : prev
    );
  }, []);

  const renderHeader = () => (
    <View className="px-6 pt-4 pb-4">
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          {!isOwnProfile
            ? (
              <Pressable
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/15 items-center justify-center"
              >
                <ArrowLeft size={18} color="#FFFFFF" />
              </Pressable>
            )
            : null}
          <View>
            <Text
              style={{ fontFamily: "WrenBold" }}
              className="text-white text-2xl"
            >
              {isOwnProfile
                ? "Profile"
                : activeProfileUser?.username || "Profile"}
            </Text>
            <Text className="text-white/35 text-xs mt-1">
              Secure profile and encrypted posts
            </Text>
          </View>
        </View>

        {isOwnProfile
          ? (
            <Pressable
              onPress={handleLogout}
              className="px-3.5 h-10 rounded-full bg-white/10 border border-white/15 flex-row items-center gap-2"
            >
              <LogOut size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text className="text-white text-xs font-semibold">Logout</Text>
            </Pressable>
          )
          : null}
      </View>

      <View className="items-center mb-6">
        <View className="w-24 h-24 rounded-full bg-white/10 border border-white/15 items-center justify-center overflow-hidden mb-4">
          {activeProfileUser?.avatar
            ? (
              <Image
                source={{ uri: activeProfileUser.avatar }}
                className="w-full h-full"
              />
            )
            : <UserRound size={28} color={colors.primary} strokeWidth={2.2} />}
        </View>

        <View className="flex-row items-center gap-1.5">
          <Text
            style={{ fontFamily: "WrenBold" }}
            className="text-white text-2xl"
          >
            {activeProfileUser?.name ||
              activeProfileUser?.username ||
              "Wren User"}
          </Text>
          {activeProfileUser?.verified
            ? <Verified size={19.5} />
            : null}
        </View>
        <Text className="text-white/55 text-sm mt-1">
          @{activeProfileUser?.username || targetUsername}
        </Text>

        {activeProfileUser?.bio
          ? (
            <Text className="text-white/55 text-sm text-center mt-3 px-8 leading-5">
              {activeProfileUser.bio}
            </Text>
          )
          : null}
      </View>

      <View className="flex-row gap-3 mb-4">
        {[
          {
            label: "Posts",
            value: metricValue(stats?.postsCount),
            onPress: null,
          },
          {
            label: "Followers",
            value: metricValue(stats?.followersCount),
            onPress: profileUid ? () => setConnectionsType("followers") : null,
          },
          {
            label: "Following",
            value: metricValue(stats?.followingCount),
            onPress: profileUid ? () => setConnectionsType("following") : null,
          },
        ].map((item) => {
          const content = (
            <View className="flex-1 rounded-2xl bg-white/5 border border-white/10 py-4 items-center">
              <Text
                style={{ fontFamily: "WrenBold" }}
                className="text-white text-lg mb-0.5"
              >
                {item.value}
              </Text>
              <Text className="text-white/45 text-xs">{item.label}</Text>
            </View>
          );

          return item.onPress
            ? (
              <Pressable
                key={item.label}
                className="flex-1"
                onPress={item.onPress}
              >
                {content}
              </Pressable>
            )
            : (
              <View key={item.label} className="flex-1">
                {content}
              </View>
            );
        })}
      </View>

      <View className="flex-row gap-3 mb-5">
        {isOwnProfile
          ? (
            <>
              <Pressable
                onPress={() => setShowSecuritySheet(true)}
                className="flex-1 h-12 rounded-full bg-white/10 border border-white/15 items-center justify-center flex-row gap-2"
              >
                <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
                <Text className="text-white text-sm font-semibold">
                  Wrencryption
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/notifications")}
                className="flex-1 h-12 rounded-full bg-secondary items-center justify-center flex-row gap-2"
              >
                <Bell size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text className="text-white text-sm font-semibold">
                  Requests {securityStats?.pendingFollowRequestsCount
                    ? `(${securityStats.pendingFollowRequestsCount})`
                    : ""}
                </Text>
              </Pressable>
            </>
          )
          : (
            <Pressable
              onPress={handleFollowToggle}
              disabled={followLoading}
              className={`flex-1 h-12 rounded-full items-center justify-center flex-row gap-2 ${followButton?.className}`}
              style={followButton?.isDefault ? { backgroundColor: colors.primary } : undefined}
            >
              {followLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <UserPlus size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text className="text-white text-sm font-semibold">
                    {followButton?.label}
                  </Text>
                </>
              )}
            </Pressable>
          )}
      </View>

      <View className="flex-row items-center justify-between mb-3">
        <Text
          style={{ fontFamily: "WrenSemiBold" }}
          className="text-white text-lg"
        >
          Posts
        </Text>
        <View className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-row items-center gap-1.5">
          <Users size={13} color={colors.primary} strokeWidth={2.2} />
          <Text className="text-white/55 text-xs">
            {isOwnProfile ? "Refetches on open" : "Profile feed"}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading && !(isOwnProfile && activeProfileUser)) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <FlatList
        data={canViewPosts ? posts : []}
        keyExtractor={(item) =>
          item.postId?.toString() ?? Math.random().toString()}
        renderItem={({ item }) => (
          <View className="px-5">
            <PostCard
              currentProfileUid={item.author.uid}
              post={item}
              onCommentPress={() => openThread(item)}
              allowDelete={isOwnProfile}
              onDeleted={handlePostDeleted}
              showMoreActions={!isOwnProfile || isOwnProfile}
              onMorePress={setOptionsPost}
            />
          </View>
        )}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={
          <View className="px-6 py-14 items-center">
            <Text className="text-white/75 text-base font-semibold mb-2">
              {canViewPosts ? "No posts yet" : "Posts are protected"}
            </Text>
            <Text className="text-white/45 text-sm text-center leading-5">
              {canViewPosts
                ? isOwnProfile
                  ? "Your encrypted posts will appear here after you publish them."
                  : `@${activeProfileUser?.username || targetUsername
                  } has not published any visible posts yet.`
                : "This profile only shares posts with accepted followers."}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: 110 }}
      />

      {selectedPost
        ? (
          <ThreadBottomSheet
            visible={threadVisible}
            post={selectedPost}
            onClose={closeThread}
            onAddReply={handleAddReply}
            onSheetVisibilityChange={setThreadVisible}
            allowDelete={isOwnProfile}
            onDeleted={handlePostDeleted}
          />
        )
        : null}

      <PostOptionsSheet
        visible={!!optionsPost}
        post={optionsPost}
        canDelete={!!optionsPost &&
          isOwnProfile &&
          optionsPost?.author?.uid === currentUser?.uid}
        onClose={() => setOptionsPost(null)}
        onDeleted={handlePostDeleted}
      />

      {profileUid && connectionsType
        ? (
          <UserConnectionsSheet
            visible={!!connectionsType}
            userId={profileUid}
            username={activeProfileUser?.username || targetUsername}
            type={connectionsType}
            canManageFollowers={isOwnProfile && connectionsType === "followers"}
            onClose={() => setConnectionsType(null)}
            onListMutated={handleConnectionsMutation}
          />
        )
        : null}

      {isOwnProfile
        ? (
          <WrencryptionSheet
            visible={showSecuritySheet}
            onClose={() => setShowSecuritySheet(false)}
            securityStats={securityStats}
            reachStats={reachStats}
          />
        )
        : null}
    </SafeAreaView>
  );
};

export default ProfileView;
