import { useRouter } from "expo-router";
import { View } from "react-native";
// import { useEncryptAnimation } from "../hooks/encryptionAnime";
import SecuritySheet from "../components/SecuritySheet";
export default function Index() {
  // const text = "encrypted";
  const router = useRouter();

  // const { display } = useEncryptAnimation(text, {
  //   delay: 3000,
  //   repeatInterval: 20 * 1000,
  //   pause: 6000,
  // });

  return (
    <View className="flex-1 bg-black">
      <SecuritySheet
        index={1}
        onContinue={() => router.push("/login")}
      />
    </View>
  );
}
