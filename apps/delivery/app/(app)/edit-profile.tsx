import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { FormField } from "../../components/ui/form-field";
import { errorMessage, useAppFeedback } from "../../components/ui/feedback";
import { getMyProfile, updateMyProfile } from "../../lib/api/delivery";
import { useAuth } from "../../lib/auth/auth-context";

export default function EditProfileScreen() {
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setFullName(profileQuery.data.fullName);
    setEmail(profileQuery.data.email ?? "");
    setVehicleNumber(profileQuery.data.vehicleNumber ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!fullName.trim()) {
        throw new Error("Full name is required.");
      }

      if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new Error("Enter a valid email address.");
      }

      return updateMyProfile(accessToken ?? "", {
        email: email.trim().toLowerCase() || null,
        fullName: fullName.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase() || null
      });
    },
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: (profile) => {
      queryClient.setQueryData(["delivery-profile"], profile);
      feedback.success("Profile updated.");
      router.back();
    }
  });

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="person-outline" title="Loading profile" />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionCard>
        <FormField
          autoCapitalize="words"
          label="Full name"
          onChangeText={setFullName}
          required
          value={fullName}
        />
        <FormField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          value={email}
        />
        <FormField
          autoCapitalize="characters"
          label="Vehicle number"
          onChangeText={setVehicleNumber}
          value={vehicleNumber}
        />
        <ActionButton
          icon="save-outline"
          label="Save profile"
          loading={updateMutation.isPending}
          onPress={() => updateMutation.mutate()}
        />
      </SectionCard>
    </Screen>
  );
}
