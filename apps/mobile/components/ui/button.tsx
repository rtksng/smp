import * as Haptics from "expo-haptics";
import { Link, type Href } from "expo-router";
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
  const content = (
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
        onPress?.(event);
      }}
      style={(state) => [
        {
          alignItems: "center",
          backgroundColor: buttonBackground(variant),
          borderColor:
            variant === "danger" ? "#F4C7C3" : colors.primaryDark,
          borderCurve: "continuous",
          borderRadius: 999,
          borderWidth: variant === "primary" ? 0 : 1,
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          minHeight: 48,
          opacity: disabled || loading ? 0.55 : state.pressed ? 0.82 : 1,
          paddingHorizontal: 20
        },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={buttonTextColor(variant)} size="small" />
      ) : null}
      <Text
        pointerEvents="none"
        style={{
          color: buttonTextColor(variant),
          fontFamily: fonts.bodySemiBold,
          fontSize: 14
        }}
      >
        {children}
      </Text>
    </Pressable>
  );

  if (href && !disabled && !loading) {
    return (
      <Link asChild href={href}>
        {content}
      </Link>
    );
  }

  return content;
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
