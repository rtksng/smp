import { heroui } from "@heroui/theme";

export default heroui({
  defaultTheme: "light",
  layout: {
    borderWidth: {
      small: "1px",
      medium: "1px",
      large: "2px"
    },
    radius: {
      small: "4px",
      medium: "6px",
      large: "8px"
    }
  },
  themes: {
    light: {
      colors: {
        background: "#eef3f1",
        foreground: "#17211f",
        primary: {
          DEFAULT: "#287c30",
          foreground: "#ffffff"
        },
        secondary: {
          DEFAULT: "#243d29",
          foreground: "#ffffff"
        },
        success: {
          DEFAULT: "#287c30",
          foreground: "#ffffff"
        },
        warning: {
          DEFAULT: "#b7791f",
          foreground: "#ffffff"
        },
        danger: {
          DEFAULT: "#9b2226",
          foreground: "#ffffff"
        },
        content1: {
          DEFAULT: "#ffffff",
          foreground: "#17211f"
        },
        content2: {
          DEFAULT: "#f4f7f6",
          foreground: "#17211f"
        },
        content3: {
          DEFAULT: "#d8e2df",
          foreground: "#17211f"
        },
        default: {
          DEFAULT: "#d8e2df",
          foreground: "#17211f"
        },
        focus: "#3cb043"
      }
    }
  }
});
