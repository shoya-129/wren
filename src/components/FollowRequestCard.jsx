import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, User, X } from "lucide-react-native";

const FollowRequestCard = ({ item, onAccept, onReject, actionType }) => {
  const isAccepting = actionType === "accept";
  const isRejecting = actionType === "reject";
  const disabled = !!actionType;

  return (
    <View className="flex-row items-center justify-between border-b border-white/20 py-4">
      {/* Profile Info */}
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center">
          <User size={18} color="#4F7DFF" strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text
            className="text-white text-base"
            numberOfLines={1}
          >
            {item.name || item.username}
          </Text>
          <Text
            className="text-white/60 text-sm"
            numberOfLines={1}
          >
            @{item.username} wants to follow you
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {/* Accept Button */}
        <Pressable
          onPress={() => onAccept(item)}
          disabled={disabled}
          className={`w-9 h-9 rounded-full bg-primary items-center justify-center ${
            disabled ? "opacity-60" : "active:opacity-80"
          }`}
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
          className={`w-9 h-9 rounded-full bg-white/10 border border-white/20 items-center justify-center ${
            disabled ? "opacity-60" : "active:opacity-80"
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
