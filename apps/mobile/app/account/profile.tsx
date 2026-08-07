import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { AccountInfoGrid, AccountPageHeader, AccountSection, AccountSectionHeader } from "@/components/account-layout";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { TextField } from "@/components/ui/text-field";
import { getCustomerProfile, updateCustomerProfile, updateCustomerProfileInputSchema } from "@/lib/api/customer";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function ProfileScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getCustomerProfile,
    queryKey: queryKeys.profile
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !session) router.replace("/login?returnTo=/account/profile");
  }, [isReady, session]);

  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.name);
    setEmail(profileQuery.data.email ?? "");
    setBusinessName(profileQuery.data.businessName ?? "");
    setGstNumber(profileQuery.data.gstNumber ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateCustomerProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.profile, profile);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    }
  });

  if (!isReady || (session && profileQuery.isLoading)) {
    return <Screen><LoadingState label="Loading profile" /></Screen>;
  }
  if (!session) return null;
  if (profileQuery.isError || !profileQuery.data) {
    return <Screen><ErrorState message={getErrorMessage(profileQuery.error, "Unable to load your profile.")} onRetry={() => profileQuery.refetch()} /></Screen>;
  }

  const profile = profileQuery.data;
  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Keep billing and customer details current for orders and invoices." title="Profile" />
      <AccountInfoGrid items={[
        { label: "Name", value: profile.name },
        { label: "Mobile", value: profile.mobileNumber },
        { label: "Email", value: profile.email ?? "Not added" },
        { label: "GST", value: profile.gstNumber ?? "Not added" }
      ]} />
      <AccountSection>
        <AccountSectionHeader description="Update billing identity, business name, email, and GST details used on invoices." title="Editable details" />
        <View style={{ gap: 14 }}>
          <TextField autoCapitalize="words" label="Customer name" onChangeText={setName} value={name} />
          <TextField editable={false} label="Mobile number" value={profile.mobileNumber} />
          <TextField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="billing@example.com" value={email} />
          <TextField autoCapitalize="words" label="Business name" onChangeText={setBusinessName} value={businessName} />
          <TextField autoCapitalize="characters" label="GST number" onChangeText={setGstNumber} value={gstNumber} />
        </View>
        {formError || updateMutation.isError ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            {formError ?? getErrorMessage(updateMutation.error, "Unable to update your profile.")}
          </Text>
        ) : null}
        {updateMutation.isSuccess ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>
            Profile updated successfully.
          </Text>
        ) : null}
        <Button
          loading={updateMutation.isPending}
          onPress={() => {
            const parsed = updateCustomerProfileInputSchema.safeParse({
              businessName: businessName.trim() || null,
              email: email.trim() || null,
              gstNumber: gstNumber.trim() || null,
              name: name.trim()
            });
            if (!parsed.success) {
              setFormError(parsed.error.issues[0]?.message ?? "Check your profile details.");
              return;
            }
            setFormError(null);
            updateMutation.mutate(parsed.data);
          }}
          style={{ alignSelf: "flex-start" }}
        >
          Save changes
        </Button>
      </AccountSection>
    </Screen>
  );
}
