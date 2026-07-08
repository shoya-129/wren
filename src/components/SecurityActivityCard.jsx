import { Text, View } from "react-native";
import {
  ClockIcon as Clock,
  KeyIcon as Key,
  LockIcon as Lock,
  ShieldCheckIcon as ShieldCheck,
  UserMinusIcon as UserMinus,
  UserPlusIcon as UserPlus,
  UserXIcon as UserX,
} from "../lib/icons";
import colors from "../lib/colors.json";

const hexToRgba = (hex, opacity) => {
  if (!hex || !hex.startsWith("#")) return "rgba(255, 255, 255, 0.1)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const formatActivityTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 600);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const getActivityIcon = (type) => {
  switch (type) {
    case "follow_request_sent":
      return { Icon: UserPlus, color: colors.primary };
    case "follow_request_accepted":
      return { Icon: Key, color: "#10B981" };
    case "follow_request_rejected":
      return { Icon: UserMinus, color: "#EF4444" };
    case "unfollowed":
      return { Icon: UserX, color: "#F59E0B" };
    case "post_created":
      return { Icon: ShieldCheck, color: "#8B5CF6" };
    case "follow_request_accept_failed":
    case "follow_request_reject_failed":
    case "follow_request_send_failed":
    case "unfollow_failed":
      return { Icon: UserX, color: "#EF4444" };
    default:
      return { Icon: Lock, color: "#71717A" };
  }
};

const SecurityActivityCard = ({ item }) => {
  const { Icon, color } = getActivityIcon(item.type);

  return (
    <View className="flex-row items-start gap-4 border-b border-white/20 py-4">
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: hexToRgba(color, 0.1) }}
      >
        <Icon size={18} color={color} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text
          className="text-white text-base mb-0.5 font-semibold"
        >
          {item.type
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}
        </Text>
        <Text
          className="text-white/50 text-sm mb-1.5 leading-snug font-medium"
        >
          {item.description}
        </Text>
        <View className="flex-row items-center gap-1">
          <Clock size={12} color="rgba(255, 255, 255, 0.3)" />
          <Text
            className="text-white/30 text-xs font-semibold"
          >
            {formatActivityTime(item.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SecurityActivityCard;
