import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import WrenIsland from "../../components/WrenIsland";
import { useUser } from "../../context/UserContext";
import { usePasswordStrength } from "../../hooks/usePasswordStrength";
import colors from "../../lib/colors.json";
import { ArrowLeftIcon, CheckIcon, LockIcon, MailIcon, ShieldAlertIcon, UserIcon, UserRoundIcon, UserRoundKeyIcon } from "../../lib/icons";
import api, { setApiAuthToken } from "../../utils/api";
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
        className={`w-4 h-4 rounded-full items-center justify-center border transition-colors ${fulfilled
          ? "border-green-500 bg-green-500/30"
          : "border-zinc-800 bg-zinc-950"
          }`}
      >
        {fulfilled && <CheckIcon size={8} color="#22C55E" />}
      </View>
      <Text
        className={`ml-2.5 text-sm transition-colors ${fulfilled ? "text-green-500" : "text-zinc-500"
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
  const [islandConfig, setIslandConfig] = useState(null);

  const strength = usePasswordStrength(password);

  const handleSignup = async () => {
    if (isLoading) return;

    if (!username.trim() || !email.trim() || !password) {
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

    if (strength.score < 2) {
      const msg = "Please choose a stronger password.";
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

      const { masterKey, salt } = await createMasterKey(password);
      const { publicKey, privateKey } = await generateKeyPair(masterKey);
      const feedKey = await generateFeedKey();

      const encryptedPrivateKey = await encryptData(privateKey, masterKey);
      const encryptedFeedKey = await encryptAsymmetric(feedKey, publicKey);

      const res = await api.post(
        "/auth/register",
        {
          username,
          email,
          password,
          encryptedPrivateKey,
          encryptedFeedKey,
          salt,
          publicKey,
        },
        { skipAuth: true },
      );

      const { user, accessToken } = res.data;

      if (!accessToken) {
        throw new Error("Missing token in register response");
      }

      setIslandConfig({
        step1Text: "Creating Account",
        step2Text: "Account Created!",
        step1IconLeft: <UserRoundIcon size={16} color={colors.primary} strokeWidth={2.8} />,
        step1IconRight: <UserRoundKeyIcon size={16} color="#10B981" strokeWidth={3} />,
        step2Icon: <LockIcon size={16} color="#10B981" strokeWidth={2.8} />,
        step1Width: 200,
        step2Width: 220,
        step1Timeout: 600,
        step2Timeout: 1400,
        onComplete: async () => {
          setApiAuthToken(accessToken);
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
        }
      });
    } catch (e) {
      console.error("Signup failed", e);
      const errMsg = e?.response?.data?.message || "Registration failed. Please try again.";
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                <ArrowLeftIcon size={20} color="#FFFFFF" />
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
                    leadingIcon={UserIcon}
                    autoCapitalize="none"
                  />

                  <FloatingLabelInput
                    label="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    leadingIcon={MailIcon}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />

                  <FloatingLabelInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    leadingIcon={LockIcon}
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
                  onPress={() => {
                    handleSignup()
                    Keyboard.dismiss()
                  }}
                  disabled={isLoading || !!islandConfig}
                  className={`h-12 rounded-full items-center justify-center ${isLoading || !!islandConfig ? "opacity-70" : "active:opacity-90"
                    }`}
                  style={{ backgroundColor: colors.primary }}
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
                    <Text style={{ color: colors.primary }} className="text-sm">Log In</Text>
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
    </TouchableWithoutFeedback>
  );
}
