import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { useUser } from "../../context/UserContext";
import { BellIcon as Bell } from "../../lib/icons";
import api from "../../utils/api";
import colors from "../../lib/colors.json";
import { encryptAsymmetric } from "../../utils/encryption";
import { showToast } from "../../utils/toast";

export default function NotificationsScreen() {
  const { feedKey, activities, addActivity } = useUser();
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("requests"); // "requests" | "activity"
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});

  // 1. Load cached follow requests on mount
  useEffect(() => {
    const loadCachedRequests = async () => {
      try {
        const cached = await AsyncStorage.getItem("cached_follow_requests");
        if (cached) {
          setRequests(JSON.parse(cached));
        }
      } catch (e) {
        console.error("Error loading cached requests:", e);
      }
    };
    loadCachedRequests();
  }, []);

  // 2. Fetch fresh pending requests from API
  const fetchPendingRequests = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await api.get("/user/follow/pending");
      setRequests(res.data);
      await AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(res.data),
      );
    } catch (e) {
      console.error("Error fetching pending requests:", e);
      showToast("Failed to load pending follow requests.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests(true);
    }, [fetchPendingRequests]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === "requests") {
      fetchPendingRequests(false);
    } else {
      setIsRefreshing(false);
    }
  };

  const handleAccept = async (item) => {
    const { followerId, username, publicKey } = item;
    if (actionInProgress[followerId]) return;

    if (!feedKey) {
      showToast("Feed key is missing. Please log in again.");
      return;
    }

    const originalRequests = [...requests];
    setActionInProgress((prev) => ({ ...prev, [followerId]: "accept" }));

    setRequests((prev) => {
      const updated = prev.filter((r) => r.followerId !== followerId);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(updated),
      ).catch(() => { });
      return updated;
    });

    addActivity(
      "follow_request_accepted",
      username,
      `You accepted follow request from @${username} & shared encrypted feed key`,
    );

    try {
      const encryptedFeedKey = await encryptAsymmetric(feedKey, publicKey);
      await api.post("/user/follow/accept", {
        followerId,
        encryptedFeedKey,
      });
    } catch (err) {
      console.error("Error accepting follow request:", err);
      setRequests(originalRequests);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(originalRequests),
      ).catch(() => { });
      showToast(`Could not accept @${username}'s follow request.`);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [followerId]: null }));
    }
  };

  const handleReject = async (item) => {
    const { followerId, username } = item;
    if (actionInProgress[followerId]) return;

    const originalRequests = [...requests];
    setActionInProgress((prev) => ({ ...prev, [followerId]: "reject" }));

    setRequests((prev) => {
      const updated = prev.filter((r) => r.followerId !== followerId);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(updated),
      ).catch(() => { });
      return updated;
    });

    addActivity(
      "follow_request_rejected",
      username,
      `You rejected follow request from @${username}`,
    );

    try {
      await api.post("/user/follow/reject", { followerId });
    } catch (e) {
      console.error("Error rejecting follow request:", e);
      setRequests(originalRequests);
      AsyncStorage.setItem(
        "cached_follow_requests",
        JSON.stringify(originalRequests),
      ).catch(() => { });
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
          <Bell size={22} color={colors.primary} strokeWidth={2} />
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
              Security Log
            </Text>
          </Pressable>
        </View>

        {/* Content List */}
        <FlatList
          data={activeTab === "requests" ? requests : activities}
          keyExtractor={(item) => item.followerId || item.id}
          renderItem={
            activeTab === "requests" ? renderRequestItem : renderActivityItem
          }
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
      </View>
    </SafeAreaView>
  );
}
