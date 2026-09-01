export const colors = {
  background: "#F3FAF9",
  border: "#C4E4E0",
  danger: "#B42318",
  dangerBackground: "#FFF5F5",
  gold: "#F59E0B",
  ink: "#123432",
  muted: "#55716E",
  primary: "#17A89D",
  primaryDark: "#0F6F68",
  primaryHover: "#0B5E59",
  primarySoft: "#E5F5F3",
  surface: "#FFFFFF",
  surfaceMuted: "#F7FCFB",
  success: "#0F6F68",
  text: "#123F3C"
} as const;

export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  heading: "PlusJakartaSans_600SemiBold",
  headingBold: "PlusJakartaSans_700Bold"
} as const;

export const cardStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: "continuous" as const,
  borderRadius: 12,
  borderWidth: 1,
  boxShadow: "0 2px 8px rgba(15, 111, 104, 0.06)"
};
