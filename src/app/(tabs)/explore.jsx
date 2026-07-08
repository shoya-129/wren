import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../../context/UserContext";
import { CompassIcon as Compass, SearchIcon as Search, UserCheckIcon as UserCheck, UserPlusIcon as UserPlus, UserRoundIcon as UserRound, VerifiedIcon as Verified } from "../../lib/icons";
import api from "../../utils/api";
import { cacheProfiles, updateCachedProfile } from "../../utils/cache";
import colors from "../../lib/colors.json";
import { getEntityUid, getFollowStatus } from "../../utils/followStatus";
import { showToast } from "../../utils/toast";
import { getPaginatedData } from "../../utils/users";

export default function ExploreScreen() {
  const router = useRouter();
  const {
    user: currentUser,
    followingStatus,
    updateFollowingStatus,
    addActivity,
  } = useUser();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const syncAcceptedFollowsFromFeed = useCallback(async () => {
    try {
      const res = await api.get("/posts/feed", {
        params: { page: 1, limit: 100 },
      });

      const acceptedAuthorIds = new Set(
        (res.data || [])
          .filter((post) => !!post?.encryptedFeedKey)
          .map((post) => getEntityUid(post?.author ?? post))
          .filter(Boolean),
      );

      acceptedAuthorIds.forEach((uid) => {
        updateFollowingStatus(uid, "accepted");
      });
    } catch (e) {
      console.warn("Failed to sync accepted follows from feed:", e);
    }
  }, [updateFollowingStatus]);

  const fetchUsers = useCallback(
    async (pageNumber = 1, showLoading = true) => {
      if (pageNumber === 1) {
        if (showLoading) setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        if (pageNumber === 1) {
          await syncAcceptedFollowsFromFeed();
        }

        const limit = 10;
        const usersRes = await api.get("/user/all", {
          params: { page: pageNumber, limit },
        });

        const normalizedUsers = getPaginatedData(usersRes.data)
          .map((u) => ({ ...u, uid: getEntityUid(u) }))
          .filter((u) => !!u.uid);
        const filtered = normalizedUsers.filter(
          (u) => u.uid !== currentUser?.uid,
        );

        if (pageNumber === 1) {
          setUsers(filtered);
          setHasMore(filtered.length >= limit);
        } else {
          setUsers((prev) => {
            const merged = [...prev, ...filtered];
            const unique = [];
            const seen = new Set();
            for (const u of merged) {
              if (!seen.has(u.uid)) {
                seen.add(u.uid);
                unique.push(u);
              }
            }
            return unique;
          });
          setHasMore(filtered.length >= limit);
        }

        setPage(pageNumber);
        cacheProfiles(filtered).catch(console.error);
      } catch (e) {
        console.error("Error fetching users:", e);
        showToast("Failed to load users list. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [currentUser?.uid, syncAcceptedFollowsFromFeed],
  );

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.uid) {
        fetchUsers(1, true);
      }
    }, [currentUser?.uid, fetchUsers]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers(1, false);
  };

  const handleFollowToggle = async (targetUser) => {
    const uid = getEntityUid(targetUser);
    const username = targetUser.username;
    if (!uid || actionInProgress[uid]) return;

    const currentStatus = followingStatus[uid] || "none";
    const nextStatus = currentStatus === "none" ? "pending" : "none";

    setActionInProgress((prev) => ({ ...prev, [uid]: true }));
    updateFollowingStatus(uid, nextStatus);

    try {
      const requestPath =
        currentStatus === "none" ? "/user/follow" : "/user/unfollow";

      let res;
      try {
        res = await api.post(`${requestPath}/${encodeURIComponent(uid)}`);
      } catch (e) {
        if (e?.response?.status === 404 && username) {
          res = await api.post(
            `${requestPath}/${encodeURIComponent(username)}`,
          );
        } else {
          throw e;
        }
      }

      let confirmedStatus = "none";
      if (currentStatus === "none") {
        confirmedStatus =
          res?.data?.follow?.status === "accepted" ? "accepted" : "pending";
        updateFollowingStatus(uid, confirmedStatus);

        addActivity(
          "follow_request_sent",
          username,
          `You requested to follow @${username}`,
        );
      } else {
        updateFollowingStatus(uid, "none");

        addActivity("unfollowed", username, `You unfollowed @${username}`);
      }

      await updateCachedProfile(uid, { followStatus: confirmedStatus }).catch(() => {});

    } catch (e) {
      console.error(`Error toggling follow for ${username}:`, e);
      updateFollowingStatus(uid, currentStatus);
      showToast(`Could not update follow status for @${username}.`);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const loadMoreUsers = () => {
    if (isLoading || isLoadingMore || !hasMore || users.length === 0) return;
    fetchUsers(page + 1, false);
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q))
    );
  });

  const renderUserItem = ({ item }) => {
    const status = getFollowStatus(
      item,
      followingStatus[item.uid] || "none",
      currentUser,
    );
    const isPending = status === "pending";
    const isAccepted = status === "accepted";
    const loading = actionInProgress[item.uid];

    let isDefault = !isPending && !isAccepted;
    let buttonBgClass = "";
    let buttonText = "Follow";
    let Icon = UserPlus;

    if (isPending) {
      buttonBgClass = "bg-white/10 border border-white/20";
      buttonText = "Requested";
      Icon = UserCheck;
    } else if (isAccepted) {
      buttonBgClass = "bg-transparent border border-white/20";
      buttonText = "Following";
      Icon = UserCheck;
    }

    return (
      <View className="flex-row items-center justify-between border-b border-white/20 py-4">
        {/* User Info */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/profile/[username]",
              params: { username: item.username, uid: item.uid },
            })
          }
          className="flex-row items-center gap-3 flex-1 mr-4"
        >
          <View className="w-12 h-12 rounded-full bg-white/10 border border-white/20 items-center justify-center">
            {item.avatar ? (
              <Image
                source={{ uri: item.avatar }}
                className="w-full h-full rounded-full"
              />
            ) : (
              <UserRound size={18} color={colors.primary} strokeWidth={2} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text
                className="text-white text-base font-semibold"
                numberOfLines={1}
              >
                {item.name || item.username}
              </Text>
              {item.verified && <Verified size={16.5} />}
            </View>
            <Text className="text-white/60 text-sm" numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
        </Pressable>

        {/* Action Button */}
        <Pressable
          onPress={() => handleFollowToggle(item)}
          disabled={loading || !item.uid}
          className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full min-w-[100px] justify-center ${buttonBgClass} ${loading || !item.uid ? "opacity-60" : "active:opacity-80"
            }`}
          style={isDefault ? { backgroundColor: colors.primary } : undefined}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-white text-xs font-semibold">
                {buttonText}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center gap-2 mb-6">
          <Compass size={22} color={colors.primary} strokeWidth={2} />
          <Text
            style={{ fontFamily: "WrenBold" }}
            className="text-white text-2xl"
          >
            Explore
          </Text>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center rounded-2xl bg-white/10 border border-white/20 px-4 h-12 mb-4">
          <Search size={18} color="#71717a" strokeWidth={2} />
          <TextInput
            placeholder="Search people by name or username..."
            placeholderTextColor="#71717a"
            className="flex-1 text-white text-base ml-3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Users List */}
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreUsers}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="py-12 items-center">
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <Text className="text-white/40 text-base text-center">
                  {searchQuery.trim()
                    ? "No users found matching your search."
                    : "Wren is better with friends. Pull down to refresh or check back later!"}
                </Text>
              )}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
