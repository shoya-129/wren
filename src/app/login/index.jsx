import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeft, Lock, User } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
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
import { useUser } from "../../context/UserContext";
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

  const handleLogin = async () => {
    if (isLoading) return;
    if (!identifier.trim() || !password) {
      Alert.alert("Invalid Input", "Please fill in all fields.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.post(
        "https://wren-server.vercel.app/auth/login",
        {
          identifier,
          password,
        },
      );

      const { user, accessToken } = res.data;

      const { masterKey } = await deriveMasterKey(password, user.salt);
      const privateKey = await decryptData(user.encryptedPrivateKey, masterKey);
      const feedKey = await decryptAsymmetric(
        user.encryptedFeedKey,
        user.publicKey,
        privateKey,
      );

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
    } catch (_e) {
      Alert.alert(
        "Login Failed",
        "Please check your credentials and try again.",
      );
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
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 self-start active:opacity-75"
            >
              <ArrowLeft size={20} color="#FFFFFF" />
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
                  leadingIcon={User}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <FloatingLabelInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  leadingIcon={Lock}
                  secureTextEntry={true}
                />
              </View>

              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                className={`h-12 rounded-full bg-primary items-center justify-center shadow-lg shadow-primary/20 ${
                  isLoading ? "opacity-70" : "active:opacity-90"
                }`}
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
                  <Text className="text-primary font-bold">Sign Up</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
