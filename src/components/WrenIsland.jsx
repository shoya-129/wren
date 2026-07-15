import { useEffect, useState, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WrenIsland({
  onComplete,
  step1Text = "Encrypting Post",
  step2Text = "Encrypted & Published",
  step1IconLeft,
  step1IconRight,
  step2Icon,
  step1Width = 220,
  step2Width = 240,
  step1Timeout = 1000,
  step2Timeout = 2800,
  entranceDuration = 180,
  fadeDuration = 150,
  springFriction = 6,
  easing = Easing.out(Easing.ease),
  style,
  // Controlled props
  status, // undefined (auto) | "loading" | "success" | "error"
  errorText = "Error occurred",
  errorIcon,
  errorWidth = 280,
  errorTimeout = 3000,
}) {
  const insets = useSafeAreaInsets();

  // Animated values
  const [pillWidth] = useState(() => new Animated.Value(60));
  const [pillHeight] = useState(() => new Animated.Value(30));
  const [pillOpacity] = useState(() => new Animated.Value(0));
  const [pillTranslateY] = useState(() => new Animated.Value(-40));

  const [iconsOpacity] = useState(() => new Animated.Value(0));
  const [iconsScale] = useState(() => new Animated.Value(0.7));

  const [lockScale] = useState(() => new Animated.Value(0));
  const [lockOpacity] = useState(() => new Animated.Value(0));

  const [textOpacity] = useState(() => new Animated.Value(0));

  const [hasEntered, setHasEntered] = useState(false);
  const pendingTransition = useRef(null);
  const hasTriggeredTransition = useRef(false);

  const runExitTransition = () => {
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 120,
        easing,
        useNativeDriver: false,
      }),
      Animated.timing(lockOpacity, {
        toValue: 0,
        duration: 120,
        easing,
        useNativeDriver: false,
      }),
      Animated.spring(pillWidth, {
        toValue: 60,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.spring(pillHeight, {
        toValue: 30,
        friction: springFriction,
        useNativeDriver: false,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(pillOpacity, {
          toValue: 0,
          duration: 150,
          easing,
          useNativeDriver: false,
        }),
        Animated.timing(pillTranslateY, {
          toValue: -30,
          duration: 150,
          easing,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (onComplete) onComplete();
      });
    });
  };

  const runCompletionTransition = (targetStatus) => {
    if (hasTriggeredTransition.current) return;
    hasTriggeredTransition.current = true;

    const isError = targetStatus === "error";
    const finalWidth = isError ? errorWidth : step2Width;
    const finalTimeout = isError ? errorTimeout : step2Timeout;

    Animated.parallel([
      Animated.timing(iconsOpacity, {
        toValue: 0,
        duration: fadeDuration,
        easing,
        useNativeDriver: false,
      }),
      Animated.spring(lockScale, {
        toValue: 1,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.timing(lockOpacity, {
        toValue: 1,
        duration: fadeDuration,
        easing,
        useNativeDriver: false,
      }),
      Animated.spring(pillWidth, {
        toValue: finalWidth,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: fadeDuration + 30,
        easing,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setTimeout(() => {
        runExitTransition();
      }, finalTimeout);
    });
  };

  // 1. Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: entranceDuration,
        easing,
        useNativeDriver: false,
      }),
      Animated.spring(pillTranslateY, {
        toValue: 0,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.spring(pillWidth, {
        toValue: step1Width,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.spring(pillHeight, {
        toValue: 46,
        friction: springFriction,
        useNativeDriver: false,
      }),
      Animated.timing(iconsOpacity, {
        toValue: 1,
        duration: entranceDuration + 20,
        easing,
        useNativeDriver: false,
      }),
      Animated.spring(iconsScale, {
        toValue: 1,
        friction: springFriction - 1,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setHasEntered(true);
      const nextStatus = pendingTransition.current || status;
      if (nextStatus && nextStatus !== "loading") {
        runCompletionTransition(nextStatus);
      } else if (!status) {
        // Automatic mode
        setTimeout(() => {
          runCompletionTransition("success");
        }, step1Timeout);
      }
    });
  }, []);

  // 2. React to status changes once entered
  useEffect(() => {
    if (!status) return;

    if (hasEntered) {
      if (status === "success" || status === "error") {
        runCompletionTransition(status);
      }
    } else {
      pendingTransition.current = status;
    }
  }, [status, hasEntered]);

  const isErrorState = status === "error" || pendingTransition.current === "error";

  return (
    <View className="absolute left-0 right-0 items-center z-[9999]" style={[{ top: insets.top + 12 }, style]}>
      <Animated.View
        className="bg-[#09090B] rounded-[23px] border border-white/10 items-center justify-center overflow-hidden relative"
        style={{
          width: pillWidth,
          height: pillHeight,
          opacity: pillOpacity,
          transform: [{ translateY: pillTranslateY }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* Step 1: Icons & Message (Loading/Pending state) */}
        <Animated.View
          className="flex-row items-center justify-center absolute"
          style={{
            opacity: iconsOpacity,
            transform: [{ scale: iconsScale }],
          }}
        >
          {step1IconLeft && (
            <View className="mr-2" style={{ transform: [{ rotate: "-15deg" }] }}>
              {step1IconLeft}
            </View>
          )}
          <Text className="text-white text-[13px] font-semibold tracking-[0.1px]">{step1Text}</Text>
          {step1IconRight && (
            <View className="ml-2" style={{ transform: [{ rotate: "15deg" }] }}>
              {step1IconRight}
            </View>
          )}
        </Animated.View>

        {/* Step 2: Completion Icon & Message (Success or Error) */}
        <Animated.View
          className="flex-row items-center justify-center absolute"
          style={{
            opacity: lockOpacity,
          }}
        >
          {isErrorState ? (
            errorIcon && (
              <Animated.View className="mr-2" style={{ transform: [{ scale: lockScale }] }}>
                {errorIcon}
              </Animated.View>
            )
          ) : (
            step2Icon && (
              <Animated.View className="mr-2" style={{ transform: [{ scale: lockScale }] }}>
                {step2Icon}
              </Animated.View>
            )
          )}
          <Animated.Text
            className={`text-[13px] font-semibold tracking-[0.1px] ${isErrorState ? "text-red-500" : "text-white"}`}
            style={{ opacity: textOpacity }}
          >
            {isErrorState ? (
              typeof errorText === "object" && errorText !== null
                ? Object.values(errorText).join(", ")
                : String(errorText || "")
            ) : (
              step2Text
            )}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
