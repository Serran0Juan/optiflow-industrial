import type { Config } from "tailwindcss";

/**
 * Paleta industrial: azules profundos para estructura, verde para resultados
 * favorables y ambar/rojo reservados exclusivamente para riesgos y alertas.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f6f9",
        surface: "#ffffff",
        line: "#e2e8f0",
        navy: {
          50: "#eef2f7",
          100: "#d6e0ec",
          200: "#adc1d8",
          300: "#7d9bbe",
          400: "#4d74a1",
          500: "#2f5583",
          600: "#234269",
          700: "#1b3352",
          800: "#13253c",
          900: "#0d1a2b",
        },
        steel: {
          50: "#f6f8fa",
          100: "#eaeff4",
          200: "#d3dde7",
          300: "#b0c0d0",
          400: "#7f93a8",
          500: "#5c718a",
          600: "#465970",
          700: "#37475b",
          800: "#2a3747",
          900: "#1d2733",
        },
        positive: {
          50: "#eefaf3",
          100: "#d2f2e0",
          200: "#a5e5c3",
          300: "#6fd2a1",
          400: "#3cb682",
          500: "#1f9569",
          600: "#177754",
          700: "#135f44",
          800: "#0f4a36",
          900: "#0b3627",
        },
        warning: {
          50: "#fff8ec",
          100: "#feecc9",
          200: "#fbd58e",
          300: "#f7bb55",
          400: "#ef9f2b",
          500: "#d9821a",
          600: "#b06414",
          700: "#8a4d12",
          800: "#6b3c11",
          900: "#4f2c0d",
        },
        danger: {
          50: "#fdf0ef",
          100: "#fbdad7",
          200: "#f4b1ac",
          300: "#e9827b",
          400: "#d95a51",
          500: "#c03c33",
          600: "#9d2e27",
          700: "#7d2621",
          800: "#61201c",
          900: "#471816",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 32, 51, 0.06), 0 1px 3px rgba(16, 32, 51, 0.04)",
        raised: "0 4px 12px rgba(16, 32, 51, 0.08)",
      },
      borderRadius: {
        card: "0.625rem",
      },
    },
  },
  plugins: [],
};

export default config;
