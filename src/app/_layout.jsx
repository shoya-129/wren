import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import "../../global.css";
import { UserProvider, useUser } from "../context/UserContext";
import colors from "../lib/colors.json";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

LogBox.ignoreLogs(["Writing to `value` during component render"]);

function RootNavigator() {
  const { isHydrating, isLoggedIn } = useUser();

  if (isHydrating) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[username]" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    WrenRegular: require("../../assets/fonts/StackSansNotch-Regular.ttf"),
    WrenMedium: require("../../assets/fonts/StackSansNotch-Medium.ttf"),
    WrenSemiBold: require("../../assets/fonts/StackSansNotch-SemiBold.ttf"),
    WrenBold: require("../../assets/fonts/StackSansNotch-Bold.ttf"),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        {/* <KeyboardProvider> */}
        <BottomSheetModalProvider>
          <RootNavigator />
        </BottomSheetModalProvider>
        {/* </KeyboardProvider> */}
      </UserProvider>
    </GestureHandlerRootView>
  );
}
