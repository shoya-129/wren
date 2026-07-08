import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Sequence of animations:
    // 1. Snappy drop-down, fade-in, and expansion of the pill along with step 1 icons/text
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
      // 2. Pause so the user can see the first state (e.g. Encrypting / Logging In)
      setTimeout(() => {
        // 3. Step 2 transition: Lock/Check icon fades/scales in, pill expands, and step 2 text fades in, while step 1 icons fade out
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
            toValue: step2Width,
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
          // 4. Pause longer so user can read what happened, then shrink and exit
          setTimeout(() => {
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
          }, step2Timeout);
        });
      }, step1Timeout);
    });
  }, [
    pillOpacity,
    pillTranslateY,
    pillWidth,
    pillHeight,
    iconsOpacity,
    iconsScale,
    lockScale,
    lockOpacity,
    textOpacity,
    onComplete,
    step1Width,
    step2Width,
    step1Timeout,
    step2Timeout,
    entranceDuration,
    fadeDuration,
    springFriction,
    easing,
  ]);

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
        {/* Step 1: Icons & Message */}
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

        {/* Step 2: Completion Icon & Message */}
        <Animated.View
          className="flex-row items-center justify-center absolute"
          style={{
            opacity: lockOpacity,
          }}
        >
          {step2Icon && (
            <Animated.View className="mr-2" style={{ transform: [{ scale: lockScale }] }}>
              {step2Icon}
            </Animated.View>
          )}
          <Animated.Text
            className="text-white text-[13px] font-semibold tracking-[0.1px]"
            style={{ opacity: textOpacity }}
          >
            {step2Text}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
