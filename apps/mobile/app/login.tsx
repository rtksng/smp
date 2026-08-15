import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { KeyboardAccessory } from "@/components/ui/keyboard-accessory";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth/auth-context";
import { normalizeIndianMobileNumber, normalizeOtpInput } from "@/lib/auth/mobile";
import { resolveAuthReturnTo } from "@/lib/auth/return-to";
import { getErrorMessage } from "@/lib/errors";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function LoginScreen() {
  const { returnTo: rawReturnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const returnTo = useMemo(
    () => resolveAuthReturnTo(rawReturnTo),
    [rawReturnTo]
  );
  const { requestOtp, session, signInWithOtp } = useAuth();
  const mobileInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const canRequestOtp = isValidMobileNumber(mobileNumber);
  const canVerifyOtp = /^\d{6}$/.test(otp);

  useEffect(() => {
    if (session) {
      router.replace(returnTo);
    }
  }, [returnTo, session]);

  useEffect(() => {
    if (step === "otp") {
      const timer = setTimeout(() => otpInputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleRequestOtp() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = await requestOtp(mobileNumber);
      setDevOtp(result.devOtp ?? null);
      setCooldown(result.resendAfterSeconds);
      setStep("otp");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to send OTP."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    if (submittingRef.current) {
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6 digit OTP.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await signInWithOtp(mobileNumber, otp);
      router.replace(returnTo);
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, "Unable to verify OTP."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen
      contentContainerStyle={{
        justifyContent: "center",
        maxWidth: 448,
        paddingBottom: 32,
        paddingTop: 16
      }}
    >
      <View style={{ ...cardStyle, borderRadius: 8, gap: 24, padding: 20 }}>
        <View style={{ gap: 10 }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.primarySoft,
              borderRadius: 12,
              height: 44,
              justifyContent: "center",
              width: 44
            }}
          >
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="shield-check"
              size={24}
            />
          </View>
          <Text
            selectable
            style={{
              color: colors.gold,
              fontFamily: fonts.bodySemiBold,
              fontSize: 11,
              textTransform: "uppercase"
            }}
          >
            Secure customer login
          </Text>
          <Text
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.heading,
              fontSize: 24,
              lineHeight: 31
            }}
          >
            Sign in with mobile OTP
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 22
            }}
          >
            We will send a one-time password to your Indian mobile number.
          </Text>
        </View>

        {step === "mobile" ? (
          <TextField
            autoCapitalize="none"
            autoComplete={process.env.EXPO_OS === "ios" ? undefined : "tel"}
            autoCorrect={false}
            enablesReturnKeyAutomatically
            inputAccessoryViewID="login-phone-actions"
            keyboardType="phone-pad"
            label="Mobile number"
            maxLength={18}
            onChangeText={setMobileNumber}
            onSubmitEditing={() => void handleRequestOtp()}
            placeholder="98765 43210"
            ref={mobileInputRef}
            returnKeyType="send"
            textContentType={
              process.env.EXPO_OS === "ios" ? "telephoneNumber" : undefined
            }
            value={mobileNumber}
          />
        ) : (
          <>
            <View style={{ ...cardStyle, backgroundColor: colors.surfaceMuted, borderRadius: 8, gap: 5, padding: 12 }}>
              <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: "uppercase" }}>OTP sent to</Text>
              <Text selectable style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{mobileNumber}</Text>
              {devOtp ? (
                <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderColor: "#9FD7D1", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text selectable style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 11, textTransform: "uppercase" }}>Dev OTP</Text>
                  <Text selectable style={{ color: colors.primaryDark, fontFamily: fonts.headingBold, fontSize: 14, fontVariant: ["tabular-nums"] }}>{devOtp}</Text>
                </View>
              ) : null}
            </View>
            <TextField
              autoCapitalize="none"
              autoComplete={
                process.env.EXPO_OS === "ios" ? undefined : "sms-otp"
              }
              autoCorrect={false}
              enablesReturnKeyAutomatically
              inputAccessoryViewID="login-otp-actions"
              keyboardType="number-pad"
              label="6-digit OTP"
              onChangeText={(value) => setOtp(normalizeOtpInput(value))}
              onSubmitEditing={() => void handleVerifyOtp()}
              placeholder="123456"
              ref={otpInputRef}
              returnKeyType="done"
              selectTextOnFocus
              textContentType={
                process.env.EXPO_OS === "ios" ? "oneTimeCode" : undefined
              }
              value={otp}
            />
          </>
        )}

        {error ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={{
              backgroundColor: colors.dangerBackground,
              borderRadius: 10,
              color: colors.danger,
              fontFamily: fonts.bodySemiBold,
              fontSize: 13,
              lineHeight: 20,
              padding: 12
            }}
          >
            {error}
          </Text>
        ) : null}

        {step === "mobile" ? (
          <Button disabled={!canRequestOtp} loading={isSubmitting} onPress={() => void handleRequestOtp()}>
            Request OTP
          </Button>
        ) : (
          <View style={{ gap: 10 }}>
            <Button disabled={!canVerifyOtp} loading={isSubmitting} onPress={() => void handleVerifyOtp()}>
              Verify and continue
            </Button>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
              <LoginTextAction
                icon="arrow-left"
                label="Change number"
                onPress={() => {
                  setError(null);
                  setDevOtp(null);
                  setOtp("");
                  setStep("mobile");
                }}
              />
              <LoginTextAction
                disabled={cooldown > 0 || isSubmitting}
                icon="refresh"
                label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                onPress={() => void handleRequestOtp()}
              />
            </View>
          </View>
        )}
      </View>
      <KeyboardAccessory
        actionLabel="Send OTP"
        disabled={isSubmitting || !canRequestOtp}
        dismissKeyboard={false}
        nativeID="login-phone-actions"
        onPress={() => void handleRequestOtp()}
      />
      <KeyboardAccessory
        actionLabel="Verify"
        disabled={isSubmitting || !canVerifyOtp}
        dismissKeyboard={false}
        nativeID="login-otp-actions"
        onPress={() => void handleVerifyOtp()}
      />
    </Screen>
  );
}

function LoginTextAction({ disabled = false, icon, label, onPress }: { disabled?: boolean; icon: "arrow-left" | "refresh"; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, opacity: disabled ? 0.5 : pressed ? 0.72 : 1 })}>
      <MaterialCommunityIcons color={disabled ? "#849C98" : colors.primaryDark} name={icon} size={16} />
      <Text style={{ color: disabled ? "#849C98" : colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function isValidMobileNumber(value: string) {
  try {
    normalizeIndianMobileNumber(value);
    return true;
  } catch {
    return false;
  }
}
