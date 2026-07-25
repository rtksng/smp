import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <View
        style={{
          ...cardStyle,
          alignItems: "center",
          gap: 14,
          padding: 28
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.primarySoft,
            borderRadius: 36,
            height: 72,
            justifyContent: "center",
            width: 72
          }}
        >
          <MaterialCommunityIcons
            color={colors.primaryDark}
            name="check-circle-outline"
            size={42}
          />
        </View>
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 24,
            textAlign: "center"
          }}
        >
          Order placed successfully
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 14,
            lineHeight: 22,
            textAlign: "center"
          }}
        >
          Your order is now in Created status. You can follow confirmation,
          packing, assignment, and delivery from your account.
        </Text>
        <Button href={{ pathname: "/orders/[id]", params: { id } }}>
          View order
        </Button>
        <Button href="/" variant="outline">
          Continue shopping
        </Button>
      </View>
    </Screen>
  );
}
