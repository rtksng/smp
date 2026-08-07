import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts } from "@/lib/theme";

type TextFieldProps = TextInputProps & {
  error?: string | null;
  label: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField({ accessibilityHint, error, label, style, ...props }, ref) {
    return (
      <View style={{ gap: 7 }}>
        <Text
          selectable
          style={{
            color: colors.text,
            fontFamily: fonts.bodySemiBold,
            fontSize: 13
          }}
        >
          {label}
        </Text>
        <TextInput
          accessibilityHint={error ?? accessibilityHint}
          accessibilityLabel={label}
          allowFontScaling
          placeholderTextColor="#839084"
          ref={ref}
          selectionColor={colors.primaryDark}
          style={[
            {
              backgroundColor: colors.surface,
              borderColor: error ? "#E19B94" : "#A9DDAE",
              borderCurve: "continuous",
              borderRadius: 999,
              borderWidth: 1,
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: 16,
              minHeight: 48,
              paddingHorizontal: 20
            },
            style
          ]}
          {...props}
        />
        {error ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={{
              color: colors.danger,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  }
);
