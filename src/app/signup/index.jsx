import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeft, Check, Lock, Mail, User } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import { useUser } from "../../context/UserContext";
import { usePasswordStrength } from "../../hooks/usePasswordStrength";
import {
  createMasterKey,
  encryptAsymmetric,
  encryptData,
  generateFeedKey,
  generateKeyPair,
} from "../../utils/encryption";

function RequirementItem({ label, fulfilled }) {
  return (
    <View className="flex-row items-center mt-2.5">
      <View
        className={`w-4 h-4 rounded-full items-center justify-center border transition-colors ${
          fulfilled
            ? "border-green-500 bg-green-500/30"
            : "border-zinc-800 bg-zinc-950"
        }`}
      >
        {fulfilled && <Check size={8} color="#22C55E" />}
      </View>
      <Text
        className={`ml-2.5 text-sm transition-colors ${
          fulfilled ? "text-green-500" : "text-zinc-500"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function Signup() {
  const router = useRouter();
  const { setSession } = useUser();
  const scrollViewRef = useRef(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const strength = usePasswordStrength(password);

  const handleSignup = async () => {
    if (isLoading) return;
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert("Invalid Input", "Please fill in all fields.");
      return;
    }
    if (strength.score < 2) {
      Alert.alert(
        "Weak Password",
        "Please choose a stronger password (at least Fair) that satisfies the length and special character requirements.",
      );
      return;
    }

    try {
      setIsLoading(true);

      const { masterKey, salt } = await createMasterKey(password);
      const { publicKey, privateKey } = await generateKeyPair(masterKey);
      const feedKey = await generateFeedKey();

      const encryptedPrivateKey = await encryptData(privateKey, masterKey);
      const encryptedFeedKey = await encryptAsymmetric(feedKey, publicKey);

      const res = await axios.post("https://wren-server.vercel.app/auth/register", {
        username,
        email,
        password,
        encryptedPrivateKey,
        encryptedFeedKey,
        salt,
        publicKey,
      });

      const { user, accessToken } = res.data;

      if (!accessToken) {
        throw new Error("Missing token in register response");
      }

      await AsyncStorage.setItem("user", JSON.stringify(user));
      await AsyncStorage.setItem("token", accessToken);

      await SecureStore.setItemAsync("privateKey", privateKey);
      await SecureStore.setItemAsync("feedKey", feedKey);
      await SecureStore.setItemAsync("publicKey", publicKey);

      await setSession({
        user,
        token: accessToken,
        privateKey,
        publicKey,
        feedKey,
      });

      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Sign up Failed", "Please try again in a moment.");
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
          ref={scrollViewRef}
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
              <View className="mb-8">
                <Text
                  style={{ fontFamily: "WrenBold" }}
                  className="text-white text-3xl mb-2"
                >
                  Create Account
                </Text>
                <Text
                  style={{ fontFamily: "WrenMedium" }}
                  className="text-zinc-400 text-base"
                >
                  Join us to start your secure social experience
                </Text>
              </View>

              <View className="mb-4">
                <FloatingLabelInput
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  leadingIcon={User}
                  autoCapitalize="none"
                />

                <FloatingLabelInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  leadingIcon={Mail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <FloatingLabelInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  leadingIcon={Lock}
                  secureTextEntry={true}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 250);
                  }}
                />
              </View>

              {/* Password Strength Section */}
              {password.length > 0 && (
                <View className="mb-6 px-1">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-zinc-500 text-sm">
                      Password Strength
                    </Text>
                    <Text
                      style={{ color: strength.color }}
                      className="text-sm"
                    >
                      {strength.label}
                    </Text>
                  </View>

                  <PasswordStrengthBar
                    score={strength.score}
                    color={strength.color}
                  />

                  <View className="flex-row gap-4 mt-2">
                    <RequirementItem
                      label="At least 8 characters"
                      fulfilled={strength.checks.length8}
                    />
                    <RequirementItem
                      label="At least 1 special character"
                      fulfilled={strength.checks.symbol}
                    />
                  </View>
                </View>
              )}

              <Pressable
                onPress={handleSignup}
                disabled={isLoading}
                className={`h-12 rounded-full bg-primary items-center justify-center shadow-lg shadow-primary/20 ${
                  isLoading ? "opacity-70" : "active:opacity-90"
                }`}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-lg"
                  >
                    Sign up
                  </Text>
                )}
              </Pressable>

              {/* Footer Navigation */}
              <View className="flex-row justify-center items-center mt-6">
                <Text className="text-zinc-500 text-sm">
                  Already have an account?{" "}
                </Text>
                <Pressable
                  onPress={() => router.push("/login")}
                  className="p-1"
                >
                  <Text className="text-primary text-sm">
                    Log In
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
