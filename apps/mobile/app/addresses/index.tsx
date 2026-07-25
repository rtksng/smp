import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Alert, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import {
  deleteAddress,
  listAddresses,
  setDefaultAddress
} from "@/lib/api/customer";
import type { Address } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function AddressesScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: Boolean(session),
    queryFn: listAddresses,
    queryKey: queryKeys.addresses
  });
  const setDefaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses })
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.addresses })
  });

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login?returnTo=/addresses");
    }
  }, [isReady, session]);

  if (isReady && !session) {
    return null;
  }

  if (!isReady || query.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading saved addresses" />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(query.error, "Unable to load addresses.")}
          onRetry={() => void query.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 5 }}>
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 24
          }}
        >
          Saved addresses
        </Text>
        <Text
          selectable
          style={{ color: colors.muted, fontFamily: fonts.body, lineHeight: 20 }}
        >
          Manage delivery locations for checkout and order records.
        </Text>
      </View>
      <Button href="/addresses/form">Add new address</Button>
      {query.data?.length === 0 ? (
        <EmptyState
          action={<Button href="/addresses/form">Add delivery address</Button>}
          description="Save a clinic, hospital, home, or work address before checkout."
          title="No saved addresses"
        />
      ) : null}
      {query.data?.map((address) => (
        <AddressCard
          address={address}
          isDeleting={
            deleteMutation.isPending && deleteMutation.variables === address.id
          }
          isSettingDefault={
            setDefaultMutation.isPending &&
            setDefaultMutation.variables === address.id
          }
          key={address.id}
          onDelete={() =>
            Alert.alert(
              "Delete address?",
              `Remove ${address.fullName}'s saved delivery address?`,
              [
                { style: "cancel", text: "Keep address" },
                {
                  onPress: () => deleteMutation.mutate(address.id),
                  style: "destructive",
                  text: "Delete"
                }
              ]
            )
          }
          onEdit={() =>
            router.push({
              pathname: "/addresses/form",
              params: { id: address.id }
            })
          }
          onSetDefault={() => setDefaultMutation.mutate(address.id)}
        />
      ))}
      {deleteMutation.error || setDefaultMutation.error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor: colors.dangerBackground,
            borderRadius: 10,
            color: colors.danger,
            fontFamily: fonts.bodySemiBold,
            padding: 12
          }}
        >
          {getErrorMessage(
            deleteMutation.error ?? setDefaultMutation.error,
            "Unable to update address."
          )}
        </Text>
      ) : null}
    </Screen>
  );
}

function AddressCard({
  address,
  isDeleting,
  isSettingDefault,
  onDelete,
  onEdit,
  onSetDefault
}: {
  address: Address;
  isDeleting: boolean;
  isSettingDefault: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  return (
    <View style={{ ...cardStyle, gap: 13, padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.primarySoft,
            borderRadius: 20,
            height: 40,
            justifyContent: "center",
            width: 40
          }}
        >
          <MaterialCommunityIcons
            color={colors.primaryDark}
            name="map-marker-outline"
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 7
            }}
          >
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.heading,
                fontSize: 15
              }}
            >
              {address.fullName}
            </Text>
            <Text
              selectable
              style={{
                backgroundColor: colors.surface,
                borderRadius: 999,
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 9,
                paddingHorizontal: 8,
                paddingVertical: 4
              }}
            >
              {address.type}
            </Text>
            {address.isDefault ? (
              <Text
                selectable
                style={{
                  backgroundColor: "#DFF3EF",
                  borderRadius: 999,
                  color: "#0F6B50",
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 9,
                  paddingHorizontal: 8,
                  paddingVertical: 4
                }}
              >
                DEFAULT
              </Text>
            ) : null}
          </View>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 20
            }}
          >
            {[address.addressLine1, address.addressLine2, address.landmark]
              .filter(Boolean)
              .join(", ")}
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12
            }}
          >
            {address.city}, {address.state} {address.pincode}
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12
            }}
          >
            {address.phone}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={{ flexGrow: 1 }}>
          <Button onPress={onEdit} variant="outline">
            Edit
          </Button>
        </View>
        {!address.isDefault ? (
          <View style={{ flexGrow: 1 }}>
            <Button
              loading={isSettingDefault}
              onPress={onSetDefault}
              variant="soft"
            >
              Set default
            </Button>
          </View>
        ) : null}
        <View style={{ flexGrow: 1 }}>
          <Button loading={isDeleting} onPress={onDelete} variant="danger">
            Delete
          </Button>
        </View>
      </View>
    </View>
  );
}
