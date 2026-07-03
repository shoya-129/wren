import React from "react";
import { Image, Text, View } from "react-native";
import { Lock, ShieldCheck } from "lucide-react-native";

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  return `${day} ${month}`;
};

const CommentItem = ({ comment, isLast = false }) => {
  const author = comment.author || {};
  const formatted = formatDate(comment.createdAt);

  return (
    <View className="flex-row items-stretch pl-4 py-2">
      {/* Thread line and Avatar */}
      <View className="items-center mr-3 relative">
        {/* Thread connector line */}
        {!isLast && (
          <View className="absolute top-10 bottom-[-8] w-px bg-white/20 left-[19px]" />
        )}
        
        {author.avatar ? (
          <Image
            source={{ uri: author.avatar }}
            className="w-10 h-10 rounded-full bg-white/10"
            resizeMode="cover"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center">
            <ShieldCheck size={16} color="#4F7DFF" strokeWidth={2} />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 border-b border-white/5 pb-2">
        <View className="flex-row items-baseline gap-1.5 mb-1">
          <Text className="text-white text-[14px] font-semibold" numberOfLines={1}>
            {author.name || author.username || "Wren User"}
          </Text>
          <Text className="text-white/40 text-xs" numberOfLines={1}>
            @{author.username || "anonymous"}
          </Text>
          <Text className="text-white/20 text-xs">•</Text>
          <Text className="text-white/40 text-xs">{formatted}</Text>
        </View>

        {comment.isDecrypted ? (
          <Text className="text-[14px] leading-relaxed text-white/80">
            {comment.content}
          </Text>
        ) : (
          <View className="bg-white/5 border border-white/10 rounded-xl p-3 flex-row items-center gap-2.5 mt-1">
            <Lock size={12} color="rgba(255,255,255,0.4)" />
            <Text className="text-white/40 text-xs font-semibold">
              Secure Reply Encrypted
            </Text>
          </View>
        )}

        {comment.isDecrypted && comment.media && (
          <View className="mt-2 rounded-xl overflow-hidden bg-white/5 border border-white/10 max-h-48">
            <Image
              source={{ uri: `data:image/jpeg;base64,${comment.media}` }}
              className="w-full h-40"
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    </View>
  );
};

export default CommentItem;
