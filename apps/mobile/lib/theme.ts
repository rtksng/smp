export const colors = {
  background: "#F4FBF5",
  border: "#CFE9D2",
  danger: "#B42318",
  dangerBackground: "#FFF5F5",
  gold: "#9B6A1E",
  ink: "#111827",
  muted: "#556B57",
  primary: "#3CB043",
  primaryDark: "#287C30",
  primaryHover: "#23702A",
  primarySoft: "#EAF7EB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FCF8",
  success: "#0A7F32",
  text: "#173B1D"
} as const;

export const fonts = {
  body: "Inter_400Regular",
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
  boxShadow: "0 2px 8px rgba(40, 124, 48, 0.06)"
};
