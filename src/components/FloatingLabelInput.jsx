import React, { useState, useEffect } from "react";
import { View, TextInput, Animated, Pressable, Text } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  leadingIcon: LeadingIcon,
  autoCapitalize = "none",
  keyboardType = "default",
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [animatedValue] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isFocused, value, animatedValue]);

  // Rough estimation of label width to compensate for scale-center alignment
  const labelWidth = label.length * 7;
  const scaleCorrection = -(labelWidth * 0.09);
  const iconOffset = LeadingIcon ? -32 : 0;
  const activeTranslateX = iconOffset + scaleCorrection;

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, activeTranslateX],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.8],
  });

  const labelBgColor = animatedValue.interpolate({
    inputRange: [0, 0.9, 1],
    outputRange: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "#000000"],
  });

  const labelColor = isFocused ? "#4F7DFF" : "#6E6C68";
  const borderClass = isFocused ? "border-primary" : "border-zinc-800";

  return (
    <View
      className={`relative h-14 w-full border rounded-xl flex-row items-center px-4 mb-4 bg-zinc-900/40 ${borderClass}`}
    >
      {LeadingIcon && (
        <View className="mr-3 justify-center items-center">
          <LeadingIcon size={20} color={isFocused ? "#4F7DFF" : "#6E6C68"} />
        </View>
      )}

      <View className="flex-1 relative justify-center h-full">
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            backgroundColor: labelBgColor,
            paddingHorizontal: 4,
            zIndex: 10,
            transform: [{ translateY }, { translateX }, { scale }],
          }}
        >
          <Text style={{ color: labelColor }} className="text-[15px]">
            {label}
          </Text>
        </Animated.View>

        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          className="flex-1 text-white text-[15px] p-0 w-full"
          selectionColor="white"
          placeholder=""
          {...props}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={(e) => {
            setIsFocused(true);
            if (props.onFocus) props.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (props.onBlur) props.onBlur(e);
          }}
        />
      </View>

      {secureTextEntry && (
        <Pressable
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          className="ml-3 p-1 active:opacity-75"
        >
          {isPasswordVisible ? (
            <EyeOff size={20} color={isFocused ? "#4F7DFF" : "#6E6C68"} />
          ) : (
            <Eye size={20} color={isFocused ? "#4F7DFF" : "#6E6C68"} />
          )}
        </Pressable>
      )}
    </View>
  );
}
