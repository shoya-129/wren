import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

export default function PasswordStrengthBar({ score, color }) {
  const [bars] = useState(() => [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);

  useEffect(() => {
    bars.forEach((bar, index) => {
      Animated.spring(bar, {
        toValue: index < score ? 1 : 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    });
  }, [bars, score]);

  return (
    <View className="flex-row gap-2 mt-3">
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            backgroundColor: color,
            transform: [{ scaleX: bar }],
          }}
          className="flex-1 h-[5px] rounded-full origin-left"
        />
      ))}
    </View>
  );
}
