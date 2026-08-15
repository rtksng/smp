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
        background: "#eef6f5",
        foreground: "#123432",
        primary: {
          DEFAULT: "#0f6f68",
          foreground: "#ffffff"
        },
        secondary: {
          DEFAULT: "#123f3c",
          foreground: "#ffffff"
        },
        success: {
          DEFAULT: "#0f6f68",
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
          foreground: "#123432"
        },
        content2: {
          DEFAULT: "#f3f8f7",
          foreground: "#123432"
        },
        content3: {
          DEFAULT: "#cbdedb",
          foreground: "#123432"
        },
        default: {
          DEFAULT: "#cbdedb",
          foreground: "#123432"
        },
        focus: "#17a89d"
      }
    }
  }
});
