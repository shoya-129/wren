import React from "react";
import { Text, View } from "react-native";
import {
  Clock,
  Key,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react-native";

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
      return { Icon: UserPlus, color: "#4F7DFF", bg: "bg-blue-500/10" };
    case "follow_request_accepted":
      return { Icon: Key, color: "#10B981", bg: "bg-emerald-500/10" };
    case "follow_request_rejected":
      return { Icon: UserMinus, color: "#EF4444", bg: "bg-red-500/10" };
    case "unfollowed":
      return { Icon: UserX, color: "#F59E0B", bg: "bg-amber-500/10" };
    case "post_created":
      return { Icon: ShieldCheck, color: "#8B5CF6", bg: "bg-violet-500/10" };
    default:
      return { Icon: Clock, color: "#71717A", bg: "bg-white/10" };
  }
};

const SecurityActivityCard = ({ item }) => {
  const { Icon, color, bg } = getActivityIcon(item.type);

  return (
    <View className="flex-row items-start gap-4 border-b border-white/20 py-4">
      <View className={`w-10 h-10 rounded-full items-center justify-center ${bg}`}>
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
