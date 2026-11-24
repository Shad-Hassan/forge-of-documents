import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Void and surface ladder (cosmology)
        void: {
          900: "#0b0f1a",
          800: "#0d1117",
          700: "#11151f",
          600: "#161b2a",
        },
        // Ivory text
        ivory: {
          100: "#f5f1e8",
          82: "#d1cac0",
          70: "#bab1a8",
        },
        // Bronze accent
        bronze: {
          600: "#a67c52",
          700: "#8b6a47",
          800: "#704e35",
        },
        // Scarce accents
        arcane: {
          500: "#7c3aed",
          600: "#6d28d9",
        },
        ember: {
          500: "#ea580c",
          600: "#c94900",
        },
        // Slate for borders only
        slate: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
        },
      },
      fontFamily: {
        display: ["Cinzel Decorative", "serif"],
        runic: ["Noto Sans Runic", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        none: "0",
      },
    },
  },
  plugins: [],
};

export default config;
