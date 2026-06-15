import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0a0a0a",
        "bg-surface": "#111111",
        "bg-card": "#161616",
        "bg-elevated": "#1c1c1c",
        "border-subtle": "#242424",
        "green-primary": "#1aff66",
        "green-dim": "#0dcc4e",
        "green-ghost": "rgba(26,255,102,0.07)",
        "grey-100": "#f0f0f0",
        "grey-300": "#a0a0a0",
        "grey-500": "#555555",
        "red-flag": "#ff4444",
        "amber-warn": "#ffaa00",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [typography],
};
export default config;
