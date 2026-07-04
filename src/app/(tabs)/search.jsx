import { Search, User, UserCheck, UserPlus } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import api from "../../utils/api";
import { getEntityUid } from "../../utils/followStatus";
import { getPaginatedData } from "../../utils/users";

export default function SearchScreen() {
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
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const [usersRes] = await Promise.all([
          api.get("/user/all", { params: { page: 1, limit: 50 } }),
          syncAcceptedFollowsFromFeed(),
        ]);

        const normalizedUsers = getPaginatedData(usersRes.data)
          .map((u) => ({ ...u, uid: getEntityUid(u) }))
          .filter((u) => !!u.uid);
        const filtered = normalizedUsers.filter(
          (u) => u.uid !== currentUser?.uid,
        );
        setUsers(filtered);
      } catch (e) {
        console.error("Error fetching users:", e);
        Alert.alert("Error", "Failed to load users list. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUser?.uid, syncAcceptedFollowsFromFeed],
  );

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.uid) {
        fetchUsers(true);
      }
    }, [currentUser?.uid, fetchUsers]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers(false);
  };

  const handleFollowToggle = async (targetUser) => {
    const uid = getEntityUid(targetUser);
    const username = targetUser.username;
    if (!uid || actionInProgress[uid]) return;

    const currentStatus = followingStatus[uid] || "none";
    const nextStatus = currentStatus === "none" ? "pending" : "none";

    setActionInProgress((prev) => ({ ...prev, [uid]: true }));
    updateFollowingStatus(uid, nextStatus);

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

      if (currentStatus === "none") {
        const confirmedStatus =
          res?.data?.follow?.status === "accepted" ? "accepted" : "pending";
        updateFollowingStatus(uid, confirmedStatus);
      } else {
        updateFollowingStatus(uid, "none");
      }
    } catch (e) {
      console.error(`Error toggling follow for ${username}:`, e);
      updateFollowingStatus(uid, currentStatus);
      Alert.alert(
        "Follow Failed",
        `Could not update follow status for @${username}.`,
      );
    } finally {
      setActionInProgress((prev) => ({ ...prev, [uid]: false }));
    }
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
    const status = followingStatus[item.uid] || "none";
    const isPending = status === "pending";
    const isAccepted = status === "accepted";
    const loading = actionInProgress[item.uid];

    let buttonBg = "bg-primary";
    let buttonText = "Follow";
    let Icon = UserPlus;

    if (isPending) {
      buttonBg = "bg-white/10 border border-white/20";
      buttonText = "Requested";
      Icon = UserCheck;
    } else if (isAccepted) {
      buttonBg = "bg-transparent border border-white/20";
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
              <User size={18} color="#4F7DFF" strokeWidth={2} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="text-white text-base font-semibold"
              numberOfLines={1}
            >
              {item.name || item.username}
            </Text>
            <Text className="text-white/60 text-sm" numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
        </Pressable>

        {/* Action Button */}
        <Pressable
          onPress={() => handleFollowToggle(item)}
          disabled={loading || !item.uid}
          className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full min-w-[100px] justify-center ${buttonBg} ${
            loading || !item.uid ? "opacity-60" : "active:opacity-80"
          }`}
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
          <Search size={22} color="#4F7DFF" strokeWidth={2} />
          <Text
            style={{ fontFamily: "WrenBold" }}
            className="text-white text-2xl"
          >
            Search
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#4F7DFF"
              colors={["#4F7DFF"]}
            />
          }
          ListEmptyComponent={
            <View className="py-12 items-center">
              {isLoading ? (
                <ActivityIndicator size="large" color="#4F7DFF" />
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
