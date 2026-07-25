import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { KeyboardAccessory } from "@/components/ui/keyboard-accessory";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth/auth-context";
import { normalizeOtpInput } from "@/lib/auth/mobile";
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
    <Screen contentContainerStyle={{ maxWidth: 560 }}>
      <View style={{ ...cardStyle, gap: 20, padding: 20 }}>
        <View style={{ gap: 10 }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.primarySoft,
              borderRadius: 12,
              height: 48,
              justifyContent: "center",
              width: 48
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
            Secure customer access
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
            {step === "mobile"
              ? "Login or create your account"
              : "Enter your one-time password"}
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
            {step === "mobile"
              ? "Use your Indian mobile number. New customers are registered automatically after verification."
              : `We sent a 6 digit OTP to ${mobileNumber}.`}
          </Text>
        </View>

        {step === "mobile" ? (
          <TextField
            autoCapitalize="none"
            autoComplete={process.env.EXPO_OS === "ios" ? undefined : "tel"}
            autoCorrect={false}
            autoFocus
            enablesReturnKeyAutomatically
            inputAccessoryViewID="login-phone-actions"
            keyboardType="phone-pad"
            label="Mobile number"
            onChangeText={setMobileNumber}
            onSubmitEditing={() => void handleRequestOtp()}
            placeholder="+91 98765 43210"
            ref={mobileInputRef}
            returnKeyType="send"
            textContentType={
              process.env.EXPO_OS === "ios" ? "telephoneNumber" : undefined
            }
            value={mobileNumber}
          />
        ) : (
          <>
            <TextField
              autoCapitalize="none"
              autoComplete={
                process.env.EXPO_OS === "ios" ? undefined : "sms-otp"
              }
              autoCorrect={false}
              enablesReturnKeyAutomatically
              inputAccessoryViewID="login-otp-actions"
              keyboardType="number-pad"
              label="One-time password"
              onChangeText={(value) => setOtp(normalizeOtpInput(value))}
              onSubmitEditing={() => void handleVerifyOtp()}
              placeholder="6 digit OTP"
              ref={otpInputRef}
              returnKeyType="done"
              selectTextOnFocus
              textContentType={
                process.env.EXPO_OS === "ios" ? "oneTimeCode" : undefined
              }
              value={otp}
            />
            {devOtp ? (
              <View
                style={{
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: colors.primarySoft,
                  borderColor: "#A9DDAE",
                  borderRadius: 999,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 7
                }}
              >
                <Text
                  selectable
                  style={{
                    color: colors.primaryDark,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 11
                  }}
                >
                  Dev OTP
                </Text>
                <Text
                  selectable
                  style={{
                    color: colors.primaryDark,
                    fontFamily: fonts.headingBold,
                    fontSize: 14,
                    fontVariant: ["tabular-nums"]
                  }}
                >
                  {devOtp}
                </Text>
              </View>
            ) : null}
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
          <Button loading={isSubmitting} onPress={() => void handleRequestOtp()}>
            Send OTP
          </Button>
        ) : (
          <View style={{ gap: 10 }}>
            <Button loading={isSubmitting} onPress={() => void handleVerifyOtp()}>
              Verify and continue
            </Button>
            <Button
              disabled={cooldown > 0 || isSubmitting}
              onPress={() => void handleRequestOtp()}
              variant="outline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </Button>
            <Button
              disabled={isSubmitting}
              onPress={() => {
                setError(null);
                setOtp("");
                setStep("mobile");
              }}
              variant="soft"
            >
              Change mobile number
            </Button>
          </View>
        )}
      </View>
      <KeyboardAccessory
        actionLabel="Send OTP"
        disabled={isSubmitting}
        dismissKeyboard={false}
        nativeID="login-phone-actions"
        onPress={() => void handleRequestOtp()}
      />
      <KeyboardAccessory
        actionLabel="Verify"
        disabled={isSubmitting}
        dismissKeyboard={false}
        nativeID="login-otp-actions"
        onPress={() => void handleVerifyOtp()}
      />
    </Screen>
  );
}
