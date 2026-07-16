import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckIcon as Check, UserIcon as User, XIcon as X, VerifiedIcon as Verified } from "../lib/icons";
import colors from "../lib/colors.json";

const FollowRequestCard = ({ item, onAccept, onReject, actionType }) => {
  const router = useRouter();
  const isAccepting = actionType === "accept";
  const isRejecting = actionType === "reject";
  const disabled = !!actionType;

  const handleProfilePress = () => {
    router.push({
      pathname: "/profile/[username]",
      params: { username: item.username },
    });
  };

  return (
    <View className="flex-row items-center justify-between border-b border-white/20 py-4">
      {/* Profile Info */}
      <Pressable onPress={handleProfilePress} className="flex-row items-center gap-3 flex-1 mr-3">
        <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center overflow-hidden">
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <User size={18} color={colors.primary} strokeWidth={2} />
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
          <Text
            className="text-white/60 text-sm"
            numberOfLines={1}
          >
            @{item.username} wants to follow you
          </Text>
        </View>
      </Pressable>

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {/* Accept Button */}
        <Pressable
          onPress={() => onAccept(item)}
          disabled={disabled}
          className={`w-9 h-9 rounded-full items-center justify-center ${disabled ? "opacity-60" : "active:opacity-80"
            }`}
          style={{ backgroundColor: colors.primary }}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          )}
        </Pressable>

        {/* Decline Button */}
        <Pressable
          onPress={() => onReject(item)}
          disabled={disabled}
          className={`w-9 h-9 rounded-full bg-white/10 border border-white/20 items-center justify-center ${disabled ? "opacity-60" : "active:opacity-80"
            }`}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <X size={18} color="#FFFFFF" strokeWidth={2.5} />
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default FollowRequestCard;
