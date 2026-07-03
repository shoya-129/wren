import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

export default function PasswordStrengthBar({
    score,
    color,
}) {
    const bars = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];

    useEffect(() => {
        bars.forEach((bar, index) => {
            Animated.spring(bar, {
                toValue: index < score ? 1 : 0,
                useNativeDriver: true,
                friction: 8,
            }).start();
        });
    }, [score]);

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
