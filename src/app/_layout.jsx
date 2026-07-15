import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../../global.css";
import { UserProvider, useUser } from "../context/UserContext";
import colors from "../lib/colors.json";
import { initializeBackgroundTask } from "../utils/bgTask";

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  useEffect(() => {
    if (loaded) {
      initializeBackgroundTask().catch(console.error);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
          </BottomSheetModalProvider>
        </UserProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
