import { useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useEncryptAnimation } from "../hooks/encryptionAnime";

export default function Index() {
  const text = "encrypted";
  const router = useRouter();

  const { display } = useEncryptAnimation(text, {
    delay: 3000,
    repeatInterval: 20 * 1000,
    pause: 6000,
  });

  return (
    <View className="flex-1 bg-black px-7 pt-24 pb-28">
      {/* Hero */}
      <View className="flex-1 justify-center">
        <View className="items-center">
          <Text
            style={{ fontFamily: "WrenSemiBold" }}
            className="text-white text-4xl text-center max-w-[300px] leading-[38px]"
          >
            <ShieldCheck
              size={22}
              color="#4F7DFF"
              strokeWidth={2.1}
            />{" "}
            Your {display}
            {"\n"}
            <Text className="text-primary">
              social experience starts here
            </Text>
          </Text>
        </View>
      </View>

      {/* Button */}
      <Pressable
        onPress={() => router.push("/login")}
        className="h-14 rounded-full bg-secondary items-center justify-center active:opacity-90"
      >
        <Text
          style={{ fontFamily: "WrenSemiBold" }}
          className="text-white text-[17px]"
        >
          Continue
        </Text>
      </Pressable>
    </View>
  );
}
