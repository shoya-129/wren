import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { ShieldCheck, User, UserMinus, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import api from "../utils/api";
import { getPaginatedData, getPaginationMeta } from "../utils/users";

const UserConnectionsSheet = ({
  visible,
  userId,
  username,
  type = "followers",
  canManageFollowers = false,
  onClose,
  onListMutated,
}) => {
  const router = useRouter();
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["80%"], []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const cacheKey = `${type}_${userId}_page_1`;
  const title = type === "followers" ? "Followers" : "Following";

  const closeSheet = useCallback(() => {
    onClose?.();
    sheetRef.current?.close();
  }, [onClose]);

  const loadPage = useCallback(
    async (nextPage = 1, { append = false, fromRefresh = false } = {}) => {
      if (!userId) return;
      if (nextPage === 1 && !append && !fromRefresh) setLoading(true);
      if (append) setLoadingMore(true);

      try {
        const res = await api.get(`/user/${userId}/${type}`, {
          params: { page: nextPage, limit: 20 },
        });
        const nextItems = getPaginatedData(res.data);
        const pagination = getPaginationMeta(res.data);

        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        setPage(nextPage);
        setHasNextPage(!!pagination?.hasNextPage);

        if (nextPage === 1) {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              items: nextItems,
              pagination,
            }),
          );
        }
      } catch (e) {
        console.error(`Failed to load ${type}`, e);
        Alert.alert(
          "Load failed",
          `Could not load ${title.toLowerCase()} right now.`,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [cacheKey, title, type, userId],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!visible || !userId) return;

      sheetRef.current?.snapToIndex(0);

      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && active) {
          const parsed = JSON.parse(cached);
          setItems(parsed?.items ?? []);
          setHasNextPage(!!parsed?.pagination?.hasNextPage);
        }
      } catch {
        // ignore cache errors
      }

      loadPage(1);
    };

    bootstrap();

    if (!visible) {
      sheetRef.current?.close();
    }

    return () => {
      active = false;
    };
  }, [cacheKey, loadPage, userId, visible]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPage(1, { fromRefresh: true });
  };

  const handleEndReached = () => {
    if (!hasNextPage || loadingMore || loading) return;
    loadPage(page + 1, { append: true });
  };

  const handleOpenProfile = (item) => {
    closeSheet();
    router.push({
      pathname: "/profile/[username]",
      params: { username: item.username, uid: item.uid },
    });
  };

  const handleRevoke = async (item) => {
    if (!canManageFollowers || revokingId || !item?.uid) return;

    setRevokingId(item.uid);
    try {
      await api.post("/user/follow/revoke", { followerId: item.uid });
      setItems((prev) => prev.filter((entry) => entry.uid !== item.uid));
      await AsyncStorage.removeItem(cacheKey);
      onListMutated?.({ type: "revoke", user: item });
    } catch (e) {
      console.error("Failed to revoke follower access", e);
      Alert.alert("Revoke failed", "Could not revoke access right now.");
    } finally {
      setRevokingId(null);
    }
  };

  const renderItem = ({ item }) => (
    <View className="flex-row items-center justify-between border-b border-white/10 py-4">
      <Pressable
        onPress={() => handleOpenProfile(item)}
        className="flex-1 flex-row items-center gap-3 mr-3"
      >
        <View className="w-11 h-11 rounded-full bg-white/10 border border-white/15 items-center justify-center overflow-hidden">
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} className="w-full h-full" />
          ) : (
            <User size={18} color="#4F7DFF" strokeWidth={2} />
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-white text-base font-semibold"
              numberOfLines={1}
            >
              {item.name || item.username}
            </Text>
            {item.verified ? (
              <ShieldCheck size={14} color="#4F7DFF" strokeWidth={2.2} />
            ) : null}
          </View>
          <Text className="text-white/50 text-sm" numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
      </Pressable>

      {canManageFollowers && type === "followers" ? (
        <Pressable
          onPress={() => handleRevoke(item)}
          disabled={revokingId === item.uid}
          className="px-3 py-2 rounded-full bg-red-500/12 border border-red-500/25 min-w-[92px] items-center"
        >
          {revokingId === item.uid ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <View className="flex-row items-center gap-1.5">
              <UserMinus size={14} color="#EF4444" strokeWidth={2.2} />
              <Text className="text-red-400 text-xs font-semibold">Revoke</Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: "#121212" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      onClose={closeSheet}
    >
      <BottomSheetFlatList
        data={items}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View className="px-2 pt-2 pb-2">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 pr-4">
                <Text
                  style={{ fontFamily: "WrenSemiBold" }}
                  className="text-white text-lg"
                >
                  {title}
                </Text>
                <Text className="text-white/45 text-sm mt-1">
                  {type === "followers"
                    ? `People following @${username}`
                    : `People @${username} follows`}
                </Text>
              </View>
              <Pressable
                onPress={closeSheet}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center"
              >
                <X size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <BottomSheetView className="items-center justify-center py-16">
              <ActivityIndicator size="large" color="#4F7DFF" />
            </BottomSheetView>
          ) : (
            <BottomSheetView className="items-center justify-center py-16 px-8">
              <Text className="text-white/40 text-center">
                No {title.toLowerCase()} found yet.
              </Text>
            </BottomSheetView>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-5 items-center">
              <ActivityIndicator color="#4F7DFF" />
            </View>
          ) : (
            <View className="h-8" />
          )
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
      />
    </BottomSheet>
  );
};

export default UserConnectionsSheet;
