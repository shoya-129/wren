import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";

const renderBackdrop = (props) => (
  <BottomSheetBackdrop
    {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    opacity={0.5}
    pressBehavior="close"
  />
);
import {
  LockIcon as Lock,
  ShieldCheckIcon as ShieldCheck,
  UserCheckIcon as UserCheck,
  UserPlusIcon as UserPlus,
  UsersIcon as Users,
  XIcon as X,
} from "../lib/icons";
import { useEffect, useMemo, useRef } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import colors from "../lib/colors.json";

const statValue = (value) => String(value ?? 0);

function StatCard({ icon, label, value, tone = "blue" }) {
  const tones = {
    green: { color: "#10B981" },
    amber: { color: "#F59E0B" },
    red: { color: "#EF4444" },
  };

  const textStyle = tone === "blue" ? { color: colors.primary } : (tones[tone] || { color: colors.primary });

  return (
    <View className="w-[48.5%] rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
      <View className="mb-2">{icon}</View>
      <Text style={textStyle} className="text-xl font-bold mb-1">
        {value}
      </Text>
      <Text className="text-white/60 text-xs leading-4">{label}</Text>
    </View>
  );
}

export default function WrencryptionSheet({
  visible,
  onClose,
  stats,
  securityStats,
  reachStats,
}) {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["82%"], []);

  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      onClose?.();
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    return () => {
      subscription.remove();
    };
  }, [visible, onClose]);

  const approvedFollowersCount = stats?.followersCount ?? 0;
  const sharedFeedKeyCount = securityStats?.feedKeySharedWithCount ?? 0;
  const pendingRequestsCount = securityStats?.pendingFollowRequestsCount ?? 0;
  const encryptedPostsCount = reachStats?.followersOnlyPostsCount ?? 0;
  const potentialAudienceCount = reachStats?.potentialAudienceCount ?? 0;
  const feedKeyCoverageLabel = `${statValue(sharedFeedKeyCount)} / ${statValue(approvedFollowersCount)}`;

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: "#121212" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      backdropComponent={renderBackdrop}
      onClose={onClose}
    >
      <BottomSheetScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetView className="pt-2 pb-2 px-4">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1 pr-4">
              <Text
                style={{ fontFamily: "WrenSemiBold" }}
                className="text-white text-lg"
              >
                Wrencryption controls
              </Text>

              <Text className="text-white/45 text-sm mt-1 leading-5">
                Your profile and posts stay followers-only. Manage feed-key
                sharing and whether new follow requests are allowed.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center"
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View className="rounded-3xl bg-white/5 border border-white/10 p-5 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <ShieldCheck size={18} color={colors.primary} strokeWidth={2.2} />
              <Text className="text-white text-base font-semibold">
                Followers-only access
              </Text>
            </View>
            <Text className="text-white/55 text-sm leading-5 mb-4">
              Wren keeps your profile and encrypted posts limited to approved
              followers only.
            </Text>
          </View>

          <View className="rounded-3xl bg-white/5 border border-white/10 p-5">
            <Text className="text-white text-base font-semibold mb-4">
              Live Wrencryption stats
            </Text>

            <View className="flex-row flex-wrap justify-between">
              <StatCard
                icon={
                  <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
                }
                label="Followers holding your feed key"
                value={statValue(sharedFeedKeyCount)}
              />
              <StatCard
                icon={<UserPlus size={16} color="#F59E0B" strokeWidth={2.2} />}
                label="Pending follow requests"
                value={statValue(pendingRequestsCount)}
                tone="amber"
              />
              <StatCard
                icon={<Lock size={16} color="#10B981" strokeWidth={2.2} />}
                label="Encrypted posts"
                value={statValue(encryptedPostsCount)}
                tone="green"
              />
              <StatCard
                icon={<Users size={16} color={colors.primary} strokeWidth={2.2} />}
                label="Potential audience"
                value={statValue(potentialAudienceCount)}
              />
            </View>

            <View className="rounded-2xl bg-black/20 border border-white/10 p-4 mt-1">
              <View className="flex-row items-center gap-2 mb-2">
                <UserCheck size={16} color="#10B981" strokeWidth={2.2} />
                <Text className="text-white text-sm font-semibold">
                  Audience snapshot
                </Text>
              </View>
              <Text className="text-white/70 text-sm font-semibold">
                Feed-key coverage: {feedKeyCoverageLabel}
              </Text>
              <Text className="text-white/45 text-xs mt-1 leading-4">
                {statValue(sharedFeedKeyCount)} of{" "}
                {statValue(approvedFollowersCount)} approved followers can
                currently decrypt your encrypted posts.{" "}
                {statValue(pendingRequestsCount)} more requests are waiting for
                approval.
              </Text>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
