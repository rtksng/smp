import { useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { KeyboardAccessory } from "@/components/ui/keyboard-accessory";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { createAddress, listAddresses, updateAddress } from "@/lib/api/customer";
import {
  addressInputSchema,
  type AddressInput,
  type AddressType
} from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { normalizeIndianMobileNumber } from "@/lib/auth/mobile";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

const addressTypes: AddressType[] = [
  "CLINIC",
  "HOSPITAL",
  "HOME",
  "WORK",
  "OTHER"
];

const emptyForm: AddressInput = {
  addressLine1: "",
  addressLine2: null,
  city: "",
  fullName: "",
  landmark: null,
  phone: "+91",
  pincode: "",
  state: "",
  type: "CLINIC"
};

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const fullNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressLine1Ref = useRef<TextInput>(null);
  const addressLine2Ref = useRef<TextInput>(null);
  const landmarkRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);
  const savingRef = useRef(false);
  const addressesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: listAddresses,
    queryKey: queryKeys.addresses
  });
  const existingAddress = useMemo(
    () => addressesQuery.data?.find((address) => address.id === id),
    [addressesQuery.data, id]
  );
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login?returnTo=/addresses/form");
    }
  }, [isReady, session]);

  useEffect(() => {
    if (existingAddress) {
      setForm({
        addressLine1: existingAddress.addressLine1,
        addressLine2: existingAddress.addressLine2,
        city: existingAddress.city,
        fullName: existingAddress.fullName,
        landmark: existingAddress.landmark,
        phone: existingAddress.phone,
        pincode: existingAddress.pincode,
        state: existingAddress.state,
        type: existingAddress.type
      });
    }
  }, [existingAddress]);

  const mutation = useMutation({
    mutationFn: (input: AddressInput) =>
      id ? updateAddress(id, input) : createAddress(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      router.back();
    },
    onSettled: () => {
      savingRef.current = false;
    }
  });

  if (!isReady || !session) {
    return null;
  }

  function updateField<K extends keyof AddressInput>(
    field: K,
    value: AddressInput[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setSubmitError(null);
  }

  function handleSubmit() {
    if (savingRef.current) {
      return;
    }

    let phone: string;

    try {
      phone = normalizeIndianMobileNumber(form.phone);
    } catch (error) {
      setFieldErrors({ phone: getErrorMessage(error, "Enter a valid phone.") });
      return;
    }

    const parsed = addressInputSchema.safeParse({ ...form, phone });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    savingRef.current = true;
    mutation.mutate(parsed.data);
  }

  return (
    <Screen contentContainerStyle={{ maxWidth: 720 }}>
      <View style={{ gap: 5 }}>
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 23
          }}
        >
          {id ? "Edit delivery address" : "Add delivery address"}
        </Text>
        <Text
          selectable
          style={{ color: colors.muted, fontFamily: fonts.body, lineHeight: 20 }}
        >
          Enter the address exactly as it should appear on delivery records.
        </Text>
      </View>
      <View style={{ ...cardStyle, gap: 15, padding: 16 }}>
        <TextField
          autoCapitalize="words"
          autoComplete={process.env.EXPO_OS === "ios" ? undefined : "name"}
          autoCorrect={false}
          autoFocus={!id}
          error={fieldErrors.fullName}
          label="Full name"
          onChangeText={(value) => updateField("fullName", value)}
          onSubmitEditing={() => phoneRef.current?.focus()}
          placeholder="Recipient or facility contact"
          ref={fullNameRef}
          returnKeyType="next"
          textContentType={process.env.EXPO_OS === "ios" ? "name" : undefined}
          value={form.fullName}
        />
        <TextField
          autoCapitalize="none"
          autoComplete={process.env.EXPO_OS === "ios" ? undefined : "tel"}
          autoCorrect={false}
          error={fieldErrors.phone}
          inputAccessoryViewID="address-phone-actions"
          keyboardType="phone-pad"
          label="Mobile number"
          onChangeText={(value) => updateField("phone", value)}
          onSubmitEditing={() => addressLine1Ref.current?.focus()}
          placeholder="+91 98765 43210"
          ref={phoneRef}
          returnKeyType="next"
          textContentType={
            process.env.EXPO_OS === "ios" ? "telephoneNumber" : undefined
          }
          value={form.phone}
        />
        <TextField
          autoCapitalize="words"
          autoComplete={
            process.env.EXPO_OS === "ios" ? undefined : "address-line1"
          }
          error={fieldErrors.addressLine1}
          label="Address line 1"
          onChangeText={(value) => updateField("addressLine1", value)}
          onSubmitEditing={() => addressLine2Ref.current?.focus()}
          placeholder="Building, street, area"
          ref={addressLine1Ref}
          returnKeyType="next"
          textContentType={
            process.env.EXPO_OS === "ios" ? "streetAddressLine1" : undefined
          }
          value={form.addressLine1}
        />
        <TextField
          autoCapitalize="words"
          autoComplete={
            process.env.EXPO_OS === "ios" ? undefined : "address-line2"
          }
          error={fieldErrors.addressLine2}
          label="Address line 2 (optional)"
          onChangeText={(value) => updateField("addressLine2", value || null)}
          onSubmitEditing={() => landmarkRef.current?.focus()}
          placeholder="Floor, department, block"
          ref={addressLine2Ref}
          returnKeyType="next"
          textContentType={
            process.env.EXPO_OS === "ios" ? "streetAddressLine2" : undefined
          }
          value={form.addressLine2 ?? ""}
        />
        <TextField
          autoCapitalize="words"
          error={fieldErrors.landmark}
          label="Landmark (optional)"
          onChangeText={(value) => updateField("landmark", value || null)}
          onSubmitEditing={() => cityRef.current?.focus()}
          placeholder="Nearby landmark"
          ref={landmarkRef}
          returnKeyType="next"
          value={form.landmark ?? ""}
        />
        <TextField
          autoCapitalize="words"
          error={fieldErrors.city}
          label="City"
          onChangeText={(value) => updateField("city", value)}
          onSubmitEditing={() => stateRef.current?.focus()}
          ref={cityRef}
          returnKeyType="next"
          textContentType={
            process.env.EXPO_OS === "ios" ? "addressCity" : undefined
          }
          value={form.city}
        />
        <TextField
          autoCapitalize="words"
          error={fieldErrors.state}
          label="State"
          onChangeText={(value) => updateField("state", value)}
          onSubmitEditing={() => pincodeRef.current?.focus()}
          ref={stateRef}
          returnKeyType="next"
          textContentType={
            process.env.EXPO_OS === "ios" ? "addressState" : undefined
          }
          value={form.state}
        />
        <TextField
          autoCapitalize="none"
          autoComplete={
            process.env.EXPO_OS === "ios" ? undefined : "postal-code"
          }
          autoCorrect={false}
          error={fieldErrors.pincode}
          inputAccessoryViewID="address-pincode-actions"
          keyboardType="number-pad"
          label="Pincode"
          onChangeText={(value) =>
            updateField("pincode", value.replace(/\D/g, "").slice(0, 6))
          }
          onSubmitEditing={handleSubmit}
          ref={pincodeRef}
          returnKeyType="done"
          textContentType={
            process.env.EXPO_OS === "ios" ? "postalCode" : undefined
          }
          value={form.pincode}
        />
        <View style={{ gap: 8 }}>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.bodySemiBold,
              fontSize: 13
            }}
          >
            Address type
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {addressTypes.map((type) => {
              const active = form.type === type;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  key={type}
                  onPress={() => updateField("type", type)}
                  style={{
                    alignItems: "center",
                    backgroundColor: active
                      ? colors.primaryDark
                      : colors.surfaceMuted,
                    borderColor: active ? colors.primaryDark : colors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 44,
                    paddingHorizontal: 12,
                    paddingVertical: 8
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: active ? colors.surface : colors.text,
                      fontFamily: fonts.bodySemiBold,
                      fontSize: 11
                    }}
                  >
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {submitError || mutation.error ? (
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
            {submitError ??
              getErrorMessage(mutation.error, "Unable to save address.")}
          </Text>
        ) : null}
        <Button loading={mutation.isPending} onPress={handleSubmit}>
          {id ? "Update address" : "Save address"}
        </Button>
        <Button onPress={() => router.back()} variant="outline">
          Cancel
        </Button>
      </View>
      <KeyboardAccessory
        actionLabel="Next"
        dismissKeyboard={false}
        nativeID="address-phone-actions"
        onPress={() => addressLine1Ref.current?.focus()}
      />
      <KeyboardAccessory
        dismissKeyboard={false}
        disabled={mutation.isPending}
        nativeID="address-pincode-actions"
        onPress={handleSubmit}
      />
    </Screen>
  );
}
