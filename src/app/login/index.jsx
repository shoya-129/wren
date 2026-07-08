import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import WrenIsland from "../../components/WrenIsland";
import { useUser } from "../../context/UserContext";
import colors from "../../lib/colors.json";
import { ArrowLeftIcon, LockIcon, ShieldAlertIcon, UserIcon, UserRoundIcon, UserRoundKeyIcon } from "../../lib/icons";
import api, { setApiAuthToken } from "../../utils/api";
import {
  decryptAsymmetric,
  decryptData,
  deriveMasterKey,
} from "../../utils/encryption";

export default function Login() {
  const router = useRouter();
  const { setSession } = useUser();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [islandConfig, setIslandConfig] = useState(null);

  const handleLogin = async () => {
    if (isLoading) return;

    if (!identifier.trim() || !password) {
      const msg = "Please fill in all fields.";
      const estimatedWidth = Math.min(320, Math.max(220, msg.length * 8 + 60));
      setIslandConfig({
        step1Text: msg,
        step2Text: msg,
        step1IconLeft: <ShieldAlertIcon size={16} color="#EF4444" strokeWidth={2.8} />,
        step2Icon: <ShieldAlertIcon size={16} color="#EF4444" strokeWidth={2.8} />,
        step1Width: estimatedWidth,
        step2Width: estimatedWidth,
        step1Timeout: 50,
        step2Timeout: 3000,
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.post(
        "/auth/login",
        {
          identifier,
          password,
        },
        { skipAuth: true },
      );

      const { user, accessToken } = res.data;

      if (!accessToken) {
        throw new Error("Missing token in login response");
      }

      const { masterKey } = await deriveMasterKey(password, user.salt);
      const privateKey = await decryptData(user.encryptedPrivateKey, masterKey);
      const feedKey = await decryptAsymmetric(
        user.encryptedFeedKey,
        user.publicKey,
        privateKey,
      );

      setIslandConfig({
        step1Text: "Logging In",
        step2Text: "Welcome Back!",
        step1IconLeft: <UserRoundIcon size={16} color={colors.primary} strokeWidth={2.8} />,
        step1IconRight: <UserRoundKeyIcon size={16} color="#10B981" strokeWidth={3} />,
        step2Icon: <LockIcon size={16} color="#10B981" strokeWidth={2.8} />,
        step1Width: 180,
        step2Width: 200,
        step1Timeout: 600,
        step2Timeout: 1400,
        onComplete: async () => {
          setApiAuthToken(accessToken);
          await SecureStore.setItemAsync("privateKey", privateKey);
          await SecureStore.setItemAsync("feedKey", feedKey);
          await SecureStore.setItemAsync("publicKey", user.publicKey);
          await AsyncStorage.setItem("user", JSON.stringify(user));
          await AsyncStorage.setItem("token", accessToken);
          await setSession({
            user,
            token: accessToken,
            privateKey,
            publicKey: user.publicKey,
            feedKey,
          });
          router.replace("/(tabs)");
        }
      });
    } catch (e) {
      console.error("Login failed", e);
      const errMsg = e?.response?.data?.message || "Please check your credentials and try again.";
      const estimatedWidth = Math.min(320, Math.max(220, errMsg.length * 8 + 60));
      setIslandConfig({
        step1Text: errMsg,
        step2Text: errMsg,
        step1IconLeft: <ShieldAlertIcon size={16} color="#EF4444" strokeWidth={2.8} />,
        step2Icon: <ShieldAlertIcon size={16} color="#EF4444" strokeWidth={2.8} />,
        step1Width: estimatedWidth,
        step2Width: estimatedWidth,
        step1Timeout: 50,
        step2Timeout: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      className="flex-1 bg-black"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexGrow: 1, justifyContent: "space-between" }}>
            <Pressable
              onPress={() => router.push("/")}
              className="w-10 h-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 self-start active:opacity-75"
            >
              <ArrowLeftIcon size={20} color="#FFFFFF" />
            </Pressable>

            <View className="my-auto py-6">
              <View className="mb-10">
                <Text
                  style={{ fontFamily: "WrenBold" }}
                  className="text-white text-3xl mb-2"
                >
                  Welcome Back
                </Text>
                <Text
                  style={{ fontFamily: "WrenMedium" }}
                  className="text-zinc-400 text-base"
                >
                  Sign in to continue your experience
                </Text>
              </View>

              <View className="mb-4">
                <FloatingLabelInput
                  label="Email or Username"
                  value={identifier}
                  onChangeText={setIdentifier}
                  leadingIcon={UserIcon}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <FloatingLabelInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  leadingIcon={LockIcon}
                  secureTextEntry={true}
                />
              </View>

              <Pressable
                onPress={handleLogin}
                disabled={isLoading || !!islandConfig}
                className={`h-12 rounded-full items-center justify-center ${isLoading || !!islandConfig ? "opacity-70" : "active:opacity-90"
                  }`}
                style={{ backgroundColor: colors.primary }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-lg"
                  >
                    Log in
                  </Text>
                )}
              </Pressable>

              {/* Footer Navigation */}
              <View className="flex-row justify-center items-center mt-8">
                <Text className="text-zinc-500">
                  Don&apos;t have an account?{" "}
                </Text>
                <Pressable onPress={() => router.push("/signup")}>
                  <Text style={{ color: colors.primary }} className="font-bold">Sign Up</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      {islandConfig && (
        <WrenIsland
          {...islandConfig}
          onComplete={async () => {
            if (islandConfig.onComplete) {
              await islandConfig.onComplete();
            }
            setIslandConfig(null);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
