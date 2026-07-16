import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FollowRequestCard from "../../components/FollowRequestCard";
import SecurityActivityCard from "../../components/SecurityActivityCard";
import WrenIsland from "../../components/WrenIsland";
import { useUser } from "../../context/UserContext";
import { updateCachedProfile, saveProfileToCache } from "../../utils/cache";
import {
  BellIcon,
  KeyIcon,
  LockIcon,
  UserCheckIcon,
  ShieldAlertIcon,
} from "../../lib/icons";
import api from "../../utils/api";
import colors from "../../lib/colors.json";
import { encryptAsymmetric } from "../../utils/encryption";
import { showToast } from "../../utils/toast";

export default function NotificationsScreen() {
  const { feedKey, activities, addActivity } = useUser();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("requests"); // "requests" | "activity"

  useEffect(() => {
    if (params?.tab) {
      setActiveTab(params.tab);
    }
  }, [params?.tab]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});
  const [islandState, setIslandState] = useState({
    visible: false,
    status: "loading",
    step1Text: "",
    step2Text: "",
    step1IconLeft: null,
    step1IconRight: null,
    step2Icon: null,
    step1Width: 220,
    step2Width: 270,
    errorText: "",
    onComplete: null,
  });

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      const res = await api.get("/user/follow/pending");
      await AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(res.data || []),
      );
      return res.data || [];
    },
  });

  // Asynchronous cache hydration for offline resilience
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem("cached_follow_requests");
        if (cached && !requests.length) {
          queryClient.setQueryData(["pendingRequests"], JSON.parse(cached));
        }
      } catch {}
    };
    loadCached();
  }, [requests.length, queryClient]);

  // Pre-cache user profiles of requesters to make navigation instant
  useEffect(() => {
    if (requests && requests.length > 0) {
      for (const item of requests) {
        saveProfileToCache(
          item.followerId,
          {
            user: {
              uid: item.followerId,
              username: item.username,
              name: item.name,
              avatar: item.avatar,
              verified: item.verified,
              publicKey: item.publicKey,
            },
            posts: [],
          },
          {},
          item.username,
        ).catch(() => {});
      }
    }
  }, [requests]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === "requests") {
      await refetch();
    }
    setIsRefreshing(false);
  };

  const handleAccept = async (item) => {
    const { followerId, username, publicKey } = item;
    if (actionInProgress[followerId]) return;

    if (!feedKey) {
      showToast("Feed key is missing. Please log in again.");
      return;
    }

    const originalRequests = queryClient.getQueryData(["pendingRequests"]) || [];
    setActionInProgress((prev) => ({ ...prev, [followerId]: "accept" }));

    // Optimistically update
    queryClient.setQueryData(["pendingRequests"], (prev) => {
      const updated = (prev || []).filter((r) => r.followerId !== followerId);
      AsyncStorage.setItem("cached_follow_requests", JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    setIslandState({
      visible: true,
      status: "loading",
      step1Text: "Securing feed key...",
      step2Text: "Key shared with the follower!",
      step1IconLeft: <KeyIcon size={14} color="#10B981" strokeWidth={2.5} />,
      step1IconRight: <LockIcon size={14} color={colors.comain} strokeWidth={2.5} />,
      step2Icon: <UserCheckIcon size={14} color={colors.primary} strokeWidth={2.5} />,
      step1Width: 220,
      step2Width: 270,
      errorText: "",
      onComplete: () => setIslandState((prev) => ({ ...prev, visible: false })),
    });

    try {
      const encryptedFeedKey = await encryptAsymmetric(feedKey, publicKey);
      await api.post("/user/follow/accept", {
        followerId,
        encryptedFeedKey,
      });

      addActivity(
        "follow_request_accepted",
        username,
        `You accepted follow request from @${username} & shared encrypted feed key`,
      );

      await updateCachedProfile(followerId, {}).catch(() => {});

      setIslandState((prev) => ({
        ...prev,
        status: "success",
      }));
    } catch (err) {
      console.error("Error accepting follow request:", err);
      queryClient.setQueryData(["pendingRequests"], originalRequests);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(originalRequests),
      ).catch(() => { });

      addActivity(
        "follow_request_accept_failed",
        username,
        `Failed to accept follow request from @${username}`,
      );

      const errMsg = `Could not accept @${username}'s follow request.`;
      setIslandState((prev) => ({
        ...prev,
        status: "error",
        errorText: errMsg,
      }));
    } finally {
      setActionInProgress((prev) => ({ ...prev, [followerId]: null }));
    }
  };

  const handleReject = async (item) => {
    const { followerId, username } = item;
    if (actionInProgress[followerId]) return;

    const originalRequests = queryClient.getQueryData(["pendingRequests"]) || [];
    setActionInProgress((prev) => ({ ...prev, [followerId]: "reject" }));

    // Optimistically update
    queryClient.setQueryData(["pendingRequests"], (prev) => {
      const updated = (prev || []).filter((r) => r.followerId !== followerId);
      AsyncStorage.setItem("cached_follow_requests", JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    try {
      await api.post("/user/follow/reject", { followerId });

      addActivity(
        "follow_request_rejected",
        username,
        `You rejected follow request from @${username}`,
      );
    } catch (e) {
      console.error("Error rejecting follow request:", e);
      queryClient.setQueryData(["pendingRequests"], originalRequests);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(originalRequests),
      ).catch(() => { });

      addActivity(
        "follow_request_reject_failed",
        username,
        `Failed to reject follow request from @${username}`,
      );

      showToast(`Could not reject @${username}'s follow request.`);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [followerId]: null }));
    }
  };

  const renderRequestItem = ({ item }) => (
    <FollowRequestCard
      item={item}
      onAccept={handleAccept}
      onReject={handleReject}
      actionType={actionInProgress[item.followerId]}
    />
  );

  const renderActivityItem = ({ item }) => <SecurityActivityCard item={item} />;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center gap-2 mb-6">
          <BellIcon size={22} color={colors.primary} strokeWidth={2} />
          <Text
            style={{ fontFamily: "WrenBold" }}
            className="text-white text-2xl"
          >
            Notifications
          </Text>
        </View>

        {/* Custom Segmented Tab Bar */}
        <View className="flex-row bg-white/5 border border-white/10 rounded-full p-1 mb-6">
          <Pressable
            onPress={() => setActiveTab("requests")}
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === "requests" ? "bg-white/10" : "bg-transparent"
              }`}
          >
            <Text
              className={`text-sm font-semibold ${activeTab === "requests" ? "text-white" : "text-white/60"
                }`}
            >
              Requests ({requests.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("activity")}
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === "activity" ? "bg-white/10" : "bg-transparent"
              }`}
          >
            <Text
              className={`text-sm font-semibold ${activeTab === "activity" ? "text-white" : "text-white/60"
                }`}
            >
              Activities
            </Text>
          </Pressable>
        </View>

        {/* Content List */}
        <FlatList
          data={activeTab === "requests" ? (requests || []) : (activities || [])}
          keyExtractor={(item, index) => `${item?.followerId || item?.id || "key"}-${index}`}
          renderItem={({ item }) => {
            if (!item) return null;
            return activeTab === "requests" ? renderRequestItem({ item }) : renderActivityItem({ item });
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="py-16 items-center">
              {isLoading && activeTab === "requests" ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <Text className="text-white/40 text-base text-center">
                  {activeTab === "requests"
                    ? "No pending follow requests. You're all caught up!"
                    : "No security activity recorded yet."}
                </Text>
              )}
            </View>
          }
        />

        {islandState.visible && (
          <WrenIsland
            status={islandState.status}
            step1Text={islandState.step1Text}
            step2Text={islandState.step2Text}
            step1IconLeft={islandState.step1IconLeft}
            step1IconRight={islandState.step1IconRight}
            step2Icon={islandState.step2Icon}
            errorIcon={<ShieldAlertIcon size={14} color="#EF4444" strokeWidth={2.5} />}
            errorText={islandState.errorText}
            step1Width={islandState.step1Width}
            step2Width={islandState.step2Width}
            errorWidth={300}
            onComplete={islandState.onComplete}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
