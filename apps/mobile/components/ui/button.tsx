import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps
} from "react-native";
import { colors, fonts } from "@/lib/theme";

type ButtonProps = PropsWithChildren<
  PressableProps & {
    href?: Href;
    loading?: boolean;
    variant?: "primary" | "outline" | "soft" | "danger";
  }
>;

export function Button({
  children,
  disabled,
  href,
  loading = false,
  onPress,
  accessibilityState,
  style,
  variant = "primary",
  ...props
}: ButtonProps) {
  const baseStyle = {
    alignItems: "center" as const,
    backgroundColor: buttonBackground(variant),
    borderColor: variant === "danger" ? "#F4C7C3" : colors.primaryDark,
    borderCurve: "continuous" as const,
    borderRadius: 999,
    borderWidth: variant === "primary" ? 0 : 1,
    flexDirection: "row" as const,
    gap: 8,
    justifyContent: "center" as const,
    minHeight: 48,
    paddingHorizontal: 20
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: loading,
        disabled: Boolean(disabled || loading)
      }}
      disabled={disabled || loading}
      onPress={(event) => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.selectionAsync();
        }
        if (href) {
          router.push(href);
        }
        onPress?.(event);
      }}
      style={(state) => [
        baseStyle,
        {
          opacity:
            disabled || loading ? 0.55 : state.pressed ? 0.82 : 1
        },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={buttonTextColor(variant)} size="small" />
      ) : null}
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        numberOfLines={1}
        pointerEvents="none"
        style={{
          color: buttonTextColor(variant),
          flexShrink: 1,
          fontFamily: fonts.bodySemiBold,
          fontSize: 14,
          textAlign: "center"
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function buttonBackground(variant: NonNullable<ButtonProps["variant"]>) {
  if (variant === "primary") {
    return colors.primaryDark;
  }
  if (variant === "soft") {
    return colors.primarySoft;
  }
  if (variant === "danger") {
    return colors.dangerBackground;
  }
  return colors.surface;
}

function buttonTextColor(variant: NonNullable<ButtonProps["variant"]>) {
  if (variant === "primary") {
    return colors.surface;
  }
  if (variant === "danger") {
    return colors.danger;
  }
  return colors.primaryDark;
}
