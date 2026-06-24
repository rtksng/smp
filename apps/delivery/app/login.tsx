import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import { registerDeliveryPartner } from "../lib/api/auth";
import { useAuth } from "../lib/auth/auth-context";
import { ActionButton } from "../components/ActionButton";
import { Screen } from "../components/Screen";

type Mode = "login" | "register";

export default function LoginScreen() {
  const { requestOtp, signInWithOtp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submitOtpRequest() {
    setLoading(true);
    try {
      await requestOtp(mobileNumber.trim());
      setOtpRequested(true);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtpVerification() {
    setLoading(true);
    try {
      await signInWithOtp({
        mobileNumber: mobileNumber.trim(),
        otp: otp.trim()
      });
      router.replace("/(app)/assignments");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration() {
    setLoading(true);
    try {
      await registerDeliveryPartner({
        email: email.trim() || undefined,
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        vehicleNumber: vehicleNumber.trim() || undefined
      });
      Alert.alert("Application submitted", "Admin approval is required before OTP login.");
      setMode("login");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>Surgical Delivery</Text>
        <Text style={styles.title}>
          {mode === "login" ? "Driver sign in" : "Driver application"}
        </Text>
      </View>

      <View style={styles.segment}>
        <SegmentButton active={mode === "login"} label="OTP" onPress={() => setMode("login")} />
        <SegmentButton
          active={mode === "register"}
          label="Apply"
          onPress={() => setMode("register")}
        />
      </View>

      <View style={styles.form}>
        {mode === "register" ? (
          <>
            <Field
              autoCapitalize="words"
              label="Full name"
              onChangeText={setFullName}
              value={fullName}
            />
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              value={email}
            />
            <Field
              autoCapitalize="characters"
              label="Vehicle number"
              onChangeText={setVehicleNumber}
              value={vehicleNumber}
            />
          </>
        ) : null}

        <Field
          keyboardType="phone-pad"
          label="Mobile number"
          onChangeText={setMobileNumber}
          value={mobileNumber}
        />

        {mode === "login" && otpRequested ? (
          <Field
            keyboardType="number-pad"
            label="OTP"
            maxLength={6}
            onChangeText={setOtp}
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
            label="Submit"
            loading={loading}
            onPress={submitRegistration}
          />
        )}
      </View>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function showError(error: unknown) {
  Alert.alert("Request failed", error instanceof Error ? error.message : "Try again.");
}

const styles = StyleSheet.create({
  brand: {
    color: "#287c30",
    fontSize: 15,
    fontWeight: "800"
  },
  field: {
    gap: 7
  },
  form: {
    gap: 14
  },
  header: {
    gap: 8,
    paddingTop: 24
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0F172A",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700"
  },
  segment: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    flexDirection: "row",
    padding: 4
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    minHeight: 40,
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: "#FFFFFF"
  },
  segmentLabel: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800"
  },
  segmentLabelActive: {
    color: "#0F172A"
  },
  title: {
    color: "#0F172A",
    fontSize: 30,
    fontWeight: "900"
  }
});
