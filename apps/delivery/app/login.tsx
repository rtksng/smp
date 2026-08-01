import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Redirect, router } from "expo-router";
import { registerDeliveryPartner } from "../lib/api/auth";
import { useAuth } from "../lib/auth/auth-context";
import { ActionButton } from "../components/ActionButton";
import { KeyboardAccessory } from "../components/KeyboardAccessory";
import { Screen } from "../components/Screen";
import { FormField } from "../components/ui/form-field";
import { SectionCard } from "../components/ui/delivery-card";
import {
  errorMessage,
  useAppFeedback
} from "../components/ui/feedback";
import {
  validateLoginForm,
  validateRegistrationForm
} from "../lib/delivery/forms";

type Mode = "login" | "register";

type LoginErrors = Partial<{
  mobileNumber: string;
  otp: string;
}>;

type RegistrationErrors = Partial<{
  email: string;
  fullName: string;
  mobileNumber: string;
}>;

const INDIA_MOBILE_PREFIX = "+91 ";
const KEYBOARD_ACCESSORY_ID = "delivery-login-keyboard";

export default function LoginScreen() {
  const { isReady, requestOtp, session, signInWithOtp } = useAuth();
  const feedback = useAppFeedback();
  const [mode, setMode] = useState<Mode>("login");
  const [mobileNumber, setMobileNumber] = useState(INDIA_MOBILE_PREFIX);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [registrationErrors, setRegistrationErrors] =
    useState<RegistrationErrors>({});
  const emailRef = useRef<TextInput>(null);
  const vehicleRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setInterval(
      () => setResendIn((value) => Math.max(value - 1, 0)),
      1_000
    );

    return () => clearInterval(timer);
  }, [resendIn]);

  if (isReady && session) {
    return <Redirect href="/(app)/assignments" />;
  }

  async function submitOtpRequest() {
    if (loading) {
      return;
    }

    if (otpRequested && resendIn > 0) {
      return;
    }

    const validation = validateLoginForm({
      mobileNumber,
      otp,
      otpRequested: false
    });
    setLoginErrors(validation.errors);

    if (!validation.isValid) {
      setFormMessage("Fix the highlighted fields before requesting an OTP.");
      feedback.warning("Check the highlighted fields.");
      return;
    }

    setLoading(true);
    setFormMessage(null);
    try {
      const otpRequest = await requestOtp(validation.values.mobileNumber);
      setMobileNumber(formatMobileInput(validation.values.mobileNumber));
      setDevOtp(otpRequest.devOtp ?? null);
      setOtp("");
      setOtpRequested(true);
      setResendIn(otpRequest.resendAfterSeconds);
      requestAnimationFrame(() => otpRef.current?.focus());
      feedback.success("OTP sent to your mobile number.", "OTP sent");
    } catch (error) {
      const message = errorMessage(error);
      setFormMessage(message);
      feedback.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtpVerification() {
    if (loading) {
      return;
    }

    const validation = validateLoginForm({
      mobileNumber,
      otp,
      otpRequested: true
    });
    setLoginErrors(validation.errors);

    if (!validation.isValid) {
      setFormMessage("Enter the mobile number and 6 digit OTP.");
      feedback.warning("Enter the mobile number and OTP.");
      return;
    }

    setLoading(true);
    setFormMessage(null);
    try {
      await signInWithOtp({
        mobileNumber: validation.values.mobileNumber,
        otp: validation.values.otp
      });
      feedback.success("Signed in successfully.");
      router.replace("/(app)/assignments");
    } catch (error) {
      const message = errorMessage(error);
      setFormMessage(message);
      feedback.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration() {
    if (loading) {
      return;
    }

    const validation = validateRegistrationForm({
      email,
      fullName,
      mobileNumber,
      vehicleNumber
    });
    setRegistrationErrors(validation.errors);

    if (!validation.isValid) {
      setFormMessage("Fix the highlighted fields before submitting.");
      feedback.warning("Check the highlighted fields.");
      return;
    }

    setLoading(true);
    setFormMessage(null);
    try {
      await registerDeliveryPartner(validation.values);
      feedback.success(
        "Admin approval is required before OTP login.",
        "Application submitted"
      );
      setMode("login");
      setOtpRequested(false);
      setOtp("");
      setDevOtp(null);
    } catch (error) {
      const message = errorMessage(error);
      setFormMessage(message);
      feedback.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Surgical Delivery</Text>
          <Text style={styles.title}>
            {mode === "login" ? "Delivery partner sign in" : "Partner application"}
          </Text>
          <Text style={styles.subtitle}>
            Use your approved mobile number to manage pickups, COD collections,
            and delivery updates.
          </Text>
        </View>

        <SectionCard>
          <View style={styles.cardContent}>
            <View style={styles.segment}>
              <SegmentButton
                active={mode === "login"}
                disabled={loading}
                label="OTP login"
                onPress={() => {
                  setMode("login");
                  setFormMessage(null);
                  setRegistrationErrors({});
                  setOtpRequested(false);
                  setOtp("");
                  setDevOtp(null);
                  setResendIn(0);
                }}
              />
              <SegmentButton
                active={mode === "register"}
                disabled={loading}
                label="Apply"
                onPress={() => {
                  setMode("register");
                  setFormMessage(null);
                  setLoginErrors({});
                  setOtpRequested(false);
                  setOtp("");
                  setDevOtp(null);
                  setResendIn(0);
                }}
              />
            </View>

            {formMessage ? (
              <View style={styles.messageBanner}>
                <Text selectable style={styles.messageText}>
                  {formMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {mode === "register" ? (
                <>
                  <FormField
                    autoCapitalize="words"
                    autoComplete="name"
                    autoCorrect={false}
                    error={registrationErrors.fullName}
                    label="Full name"
                    onChangeText={setFullName}
                    onSubmitEditing={() => emailRef.current?.focus()}
                    placeholder="Driver full name"
                    returnKeyType="next"
                    required
                    submitBehavior="submit"
                    textContentType="name"
                    value={fullName}
                  />
                  <FormField
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    error={registrationErrors.email}
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setEmail}
                    onSubmitEditing={() => vehicleRef.current?.focus()}
                    placeholder="driver@example.com"
                    ref={emailRef}
                    returnKeyType="next"
                    spellCheck={false}
                    submitBehavior="submit"
                    textContentType="emailAddress"
                    value={email}
                  />
                  <FormField
                    autoCapitalize="characters"
                    autoCorrect={false}
                    label="Vehicle number"
                    onChangeText={setVehicleNumber}
                    onSubmitEditing={() => mobileRef.current?.focus()}
                    placeholder="DL 01 AB 1234"
                    ref={vehicleRef}
                    returnKeyType="next"
                    spellCheck={false}
                    submitBehavior="submit"
                    value={vehicleNumber}
                  />
                </>
              ) : null}

              {mode === "register" || !otpRequested ? (
                <FormField
                  autoComplete="tel"
                  error={
                    mode === "register"
                      ? registrationErrors.mobileNumber
                      : loginErrors.mobileNumber
                  }
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  keyboardType="phone-pad"
                  label="Mobile number"
                  onChangeText={(value) =>
                    setMobileNumber(formatMobileInput(value))
                  }
                  onSubmitEditing={() => {
                    if (mode === "register") {
                      void submitRegistration();
                    } else {
                      void submitOtpRequest();
                    }
                  }}
                  placeholder="+91 98765 43210"
                  ref={mobileRef}
                  returnKeyType={mode === "register" ? "done" : "next"}
                  required
                  submitBehavior="submit"
                  textContentType="telephoneNumber"
                  value={mobileNumber}
                />
              ) : null}

              {mode === "login" && otpRequested ? (
                <>
                  <View style={styles.otpStatusCard}>
                    <Text style={styles.otpStatusLabel}>OTP sent to</Text>
                    <Text selectable style={styles.otpStatusMobile}>
                      {mobileNumber}
                    </Text>
                    {devOtp ? (
                      <View
                        accessibilityLabel={`Development OTP ${devOtp}`}
                        style={styles.devOtpBadge}
                      >
                        <Text selectable style={styles.devOtpLabel}>
                          Dev OTP
                        </Text>
                        <Text selectable style={styles.devOtpValue}>
                          {devOtp}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <FormField
                    autoComplete="one-time-code"
                    error={loginErrors.otp}
                    inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                    keyboardType="number-pad"
                    label="6-digit OTP"
                    maxLength={6}
                    onChangeText={(value) =>
                      setOtp(value.replace(/\D/g, "").slice(0, 6))
                    }
                    onSubmitEditing={() => void submitOtpVerification()}
                    placeholder="123456"
                    ref={otpRef}
                    returnKeyType="done"
                    required
                    submitBehavior="submit"
                    textContentType="oneTimeCode"
                    value={otp}
                  />
                </>
              ) : null}

              {mode === "login" ? (
                otpRequested ? (
                  <>
                    <ActionButton
                      icon="checkmark-circle-outline"
                      label="Verify"
                      loading={loading}
                      onPress={submitOtpVerification}
                    />
                    <View style={styles.otpActions}>
                      <ActionButton
                        disabled={loading || resendIn > 0}
                        icon="refresh-outline"
                        label={
                          resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"
                        }
                        onPress={submitOtpRequest}
                        style={styles.flexAction}
                        tone="secondary"
                      />
                      <ActionButton
                        disabled={loading}
                        icon="create-outline"
                        label="Change number"
                        onPress={() => {
                          setOtpRequested(false);
                          setOtp("");
                          setDevOtp(null);
                          setResendIn(0);
                          requestAnimationFrame(() => mobileRef.current?.focus());
                        }}
                        style={styles.flexAction}
                        tone="secondary"
                      />
                    </View>
                  </>
                ) : (
                  <ActionButton
                    icon="keypad-outline"
                    label="Send OTP"
                    loading={loading}
                    onPress={submitOtpRequest}
                  />
                )
              ) : (
                <ActionButton
                  icon="document-text-outline"
                  label="Submit application"
                  loading={loading}
                  onPress={submitRegistration}
                />
              )}
            </View>
          </View>
        </SectionCard>

        <Text style={styles.helperText}>
          Stay signed in only on your own delivery device.
        </Text>
      </View>
      <KeyboardAccessory nativeID={KEYBOARD_ACCESSORY_ID} />
    </Screen>
  );
}

function formatMobileInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const localNumber = digits.startsWith("91") ? digits.slice(2) : digits;

  return `${INDIA_MOBILE_PREFIX}${localNumber.slice(0, 10)}`;
}

function SegmentButton({
  active,
  disabled,
  label,
  onPress
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityState={{ disabled, selected: active }}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && styles.segmentButtonActive,
        disabled && styles.disabledSegment
      ]}
      hitSlop={4}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: "#287C30",
    fontSize: 16,
    fontWeight: "900"
  },
  cardContent: {
    gap: 14,
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  container: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 430,
    width: "100%"
  },
  devOtpBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#EAF7EB",
    borderColor: "#A9DDAE",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  devOtpLabel: {
    color: "#287C30",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  devOtpValue: {
    color: "#287C30",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: 2
  },
  disabledSegment: {
    opacity: 0.55
  },
  form: {
    gap: 12
  },
  flexAction: {
    flex: 1
  },
  header: {
    alignItems: "center",
    gap: 8
  },
  helperText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  messageBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  messageText: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  otpActions: {
    flexDirection: "row",
    gap: 8
  },
  otpStatusCard: {
    backgroundColor: "#F8FBFA",
    borderColor: "#CFE9D2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  otpStatusLabel: {
    color: "#687773",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  otpStatusMobile: {
    color: "#17211F",
    fontSize: 14,
    fontWeight: "700"
  },
  screen: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  segment: {
    backgroundColor: "#EEF2F7",
    borderColor: "#CBD5E1",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 44
  },
  segmentButtonActive: {
    backgroundColor: "#E8F5EC",
    borderColor: "#287C30",
    borderWidth: 1
  },
  segmentLabel: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800"
  },
  segmentLabelActive: {
    color: "#166534"
  },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 350,
    textAlign: "center"
  },
  title: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center"
  }
});
