import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import {
  Key,
  Lock,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";

const ORBIT_SIZE = 200;
const ICON_SIZE = 40;
const ICON_ORBIT_RADIUS = 80;
const RING_SIZE = 140;
const RING_MASK_SIZE = 50;
const CENTER = ORBIT_SIZE / 2;

const orbitIcons = [
  {
    Icon: UserPlus,
    color: "#4F7DFF",
    backgroundColor: "rgba(59,130,246,0.1)",
    angle: -90,
  },
  {
    Icon: Key,
    color: "#10B981",
    backgroundColor: "rgba(16,185,129,0.1)",
    angle: -30,
  },
  {
    Icon: ShieldCheck,
    color: "#8B5CF6",
    backgroundColor: "rgba(139,92,246,0.1)",
    angle: 30,
  },
  {
    Icon: UserX,
    color: "#F59E0B",
    backgroundColor: "rgba(245,158,11,0.1)",
    angle: 90,
  },
  {
    Icon: UserMinus,
    color: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.1)",
    angle: 150,
  },
  {
    Icon: Lock,
    color: "#71717A",
    backgroundColor: "rgba(255,255,255,0.1)",
    angle: 210,
  },
];

const getOrbitPosition = (angle) => {
  const rad = (angle * Math.PI) / 180;
  return {
    left: CENTER + ICON_ORBIT_RADIUS * Math.cos(rad) - ICON_SIZE / 2,
    top: CENTER + ICON_ORBIT_RADIUS * Math.sin(rad) - ICON_SIZE / 2,
  };
};

const SecuritySheet = ({
  ref,
  onContinue,
  isLoading,
  index = -1,
  panDown = false,
}) => {
  const [orbitRotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.delay(4000),
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [orbitRotation]);

  const orbitSpin = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <BottomSheet
      className="flex-1"
      ref={ref}
      snapPoints={["65%"]}
      index={index}
      enablePanDownToClose={panDown}
      backgroundStyle={{ backgroundColor: "#121212" }}
      handleIndicatorStyle={{
        backgroundColor: "rgba(255,255,255,0.25)",
        width: 42,
      }}
    >
      <BottomSheetView className="flex-1 px-6 pt-3 pb-8">
        <View className="items-center mt-1">
          <View
            className="relative items-center justify-center"
            style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}
          >
            <Animated.View
              className="absolute items-center justify-center"
              style={{
                width: ORBIT_SIZE,
                height: ORBIT_SIZE,
                transform: [{ rotate: orbitSpin }],
              }}
            >
              <View
                className="absolute rounded-full border"
                style={{
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />

              {orbitIcons.map(({ angle }, idx) => {
                const position = getOrbitPosition(angle);
                return (
                  <View
                    key={`mask-${idx}`}
                    className="absolute rounded-full"
                    style={{
                      width: RING_MASK_SIZE,
                      height: RING_MASK_SIZE,
                      backgroundColor: "#121212",
                      left: position.left - (RING_MASK_SIZE - ICON_SIZE) / 2,
                      top: position.top - (RING_MASK_SIZE - ICON_SIZE) / 2,
                    }}
                  />
                );
              })}

              {orbitIcons.map(
                ({ Icon, color, backgroundColor, angle }, idx) => {
                  const position = getOrbitPosition(angle);
                  return (
                    <View
                      key={idx}
                      className="absolute rounded-full items-center justify-center"
                      style={{
                        width: ICON_SIZE,
                        height: ICON_SIZE,
                        backgroundColor,
                        left: position.left,
                        top: position.top,
                      }}
                    >
                      <Icon size={17} color={color} strokeWidth={2.2} />
                    </View>
                  );
                },
              )}
            </Animated.View>

            <View
              className="h-20 w-20 rounded-full items-center justify-center border border-white/10"
              style={{ backgroundColor: "#121212" }}
            >
              <View
                className="h-14 w-14 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(79,125,255,0.18)" }}
              >
                <ShieldCheck size={26} color="#4F7DFF" strokeWidth={2.2} />
              </View>
            </View>
          </View>
        </View>

        <Text
          style={{ fontFamily: "WrenSemiBold" }}
          className="text-white text-[28px] text-center mt-3 leading-9"
        >
          Your posts stay encrypted
        </Text>

        <Text className="text-white/55 text-sm text-center mt-3 leading-5 px-2">
          Content is encrypted locally on your device before reaching our
          servers. Only authorized followers can decrypt it.
        </Text>

        <Pressable
          onPress={onContinue}
          disabled={isLoading}
          className="mt-12 rounded-full h-14 items-center justify-center flex-row bg-secondary"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{ fontFamily: "WrenSemiBold" }}
              className="text-white text-lg"
            >
              Continue
            </Text>
          )}
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
};

export default SecuritySheet;
