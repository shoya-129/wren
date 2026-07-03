import { Settings, User } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../../context/UserContext";
import { useRouter } from "expo-router";
import { Image } from "react-native";
export default function ProfileScreen() {
  const { user, logout } = useUser();
  const router = useRouter();

  const LogOut = async () => {
    await logout();
    router.replace("/login");
  };
  
  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="px-6 pt-4 pb-8">
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center gap-2">
            <User size={22} color="#4F7DFF" strokeWidth={2} />
            <Text
              style={{ fontFamily: "WrenBold" }}
              className="text-white text-2xl"
            >
              Profile
            </Text>
          </View>
          <Pressable className="w-10 h-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 active:opacity-75">
            <Settings size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>

        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-primary items-center justify-center mb-4">
            {user.avatar && <Image source={{ uri: user.avatar }} className="w-20 h-20 rounded-full" />}
          </View>
          <Text
            style={{ fontFamily: "WrenBold" }}
            className="text-white text-xl mb-1"
          >
            {user.name || user.username}
          </Text>
          <Text
            style={{ fontFamily: "WrenRegular" }}
            className="text-zinc-500 text-sm"
          >
            @{user.username}
          </Text>
        </View>

        <View className="flex-row rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          {[
            { label: "Posts", value: "0" },
            { label: "Followers", value: "0" },
            { label: "Following", value: "0" },
          ].map((stat, index) => (
            <View
              key={stat.label}
              className={`flex-1 items-center py-4 ${
                index < 2 ? "border-r border-zinc-800" : ""
              }`}
            >
              <Text
                style={{ fontFamily: "WrenBold" }}
                className="text-white text-lg mb-0.5"
              >
                {stat.value}
              </Text>
              <Text
                style={{ fontFamily: "WrenRegular" }}
                className="text-zinc-500 text-xs"
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => LogOut()}
          className="rounded-full bg-primary w-full px-4 py-2 h-12 items-center justify-center mt-6"
        >
          <Text className="text-xl text-white">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
