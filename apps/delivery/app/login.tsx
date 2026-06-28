import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { registerDeliveryPartner } from "../lib/api/auth";
import { useAuth } from "../lib/auth/auth-context";
import { ActionButton } from "../components/ActionButton";
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

export default function LoginScreen() {
  const { requestOtp, signInWithOtp } = useAuth();
  const feedback = useAppFeedback();
  const [mode, setMode] = useState<Mode>("login");
  const [mobileNumber, setMobileNumber] = useState(INDIA_MOBILE_PREFIX);
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [registrationErrors, setRegistrationErrors] =
    useState<RegistrationErrors>({});

  async function submitOtpRequest() {
    if (loading) {
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
      setOtp(otpRequest.devOtp ?? "");
      setOtpRequested(true);
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
    } catch (error) {
      const message = errorMessage(error);
      setFormMessage(message);
      feedback.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.screen}>
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
                    error={registrationErrors.fullName}
                    label="Full name"
                    onChangeText={setFullName}
                    placeholder="Driver full name"
                    required
                    textContentType="name"
                    value={fullName}
                  />
                  <FormField
                    autoCapitalize="none"
                    autoComplete="email"
                    error={registrationErrors.email}
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setEmail}
                    placeholder="driver@example.com"
                    textContentType="emailAddress"
                    value={email}
                  />
                  <FormField
                    autoCapitalize="characters"
                    label="Vehicle number"
                    onChangeText={setVehicleNumber}
                    placeholder="DL 01 AB 1234"
                    value={vehicleNumber}
                  />
                </>
              ) : null}

              <FormField
                autoComplete="tel"
                error={
                  mode === "register"
                    ? registrationErrors.mobileNumber
                    : loginErrors.mobileNumber
                }
                keyboardType="phone-pad"
                label="Mobile number"
                onChangeText={(value) => setMobileNumber(formatMobileInput(value))}
                placeholder="+91 98765 43210"
                required
                textContentType="telephoneNumber"
                value={mobileNumber}
              />

              {mode === "login" && otpRequested ? (
                <FormField
                  autoComplete="one-time-code"
                  error={loginErrors.otp}
                  keyboardType="number-pad"
                  label="OTP"
                  maxLength={6}
                  onChangeText={setOtp}
                  placeholder="6 digit OTP"
                  required
                  textContentType="oneTimeCode"
                  value={otp}
                />
              ) : null}

              {mode === "login" ? (
                otpRequested ? (
                  <ActionButton
                    icon="checkmark-circle-outline"
                    label="Verify"
                    loading={loading}
                    onPress={submitOtpVerification}
                  />
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
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && styles.segmentButtonActive,
        disabled && styles.disabledSegment
      ]}
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
  disabledSegment: {
    opacity: 0.55
  },
  form: {
    gap: 12
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
