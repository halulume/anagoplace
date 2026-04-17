import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          50:  "#f3f0ff",
          100: "#e9e2ff",
          200: "#d5caff",
          300: "#b8a8ff",
          400: "#9b7dff",
          500: "#836EF9",
          600: "#6d4ff0",
          700: "#5a39d6",
          800: "#4a2fb0",
          900: "#3d2a8a",
          950: "#200052",
        },
        dark: {
          DEFAULT: "#06060b",
          50:  "#0d0d15",
          100: "#13131f",
          200: "#1a1a2e",
          300: "#25254a",
        },
        accent: {
          cyan: "#00d4ff",
          pink: "#ff6bcb",
          gold: "#ffd700",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "monad-gradient": "linear-gradient(135deg, #200052 0%, #06060b 50%, #1a0035 100%)",
        "card-gradient": "linear-gradient(145deg, rgba(131,110,249,0.08) 0%, rgba(32,0,82,0.2) 100%)",
        "glow-purple": "radial-gradient(circle at center, rgba(131,110,249,0.3) 0%, transparent 70%)",
        "glow-cyan": "radial-gradient(circle at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
        "mesh-gradient": "radial-gradient(at 40% 20%, rgba(131,110,249,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(0,212,255,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(255,107,203,0.08) 0px, transparent 50%)",
        "hero-gradient": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(131,110,249,0.3) 0%, transparent 70%)",
        "border-gradient": "linear-gradient(135deg, rgba(131,110,249,0.5), rgba(0,212,255,0.3), rgba(255,107,203,0.3))",
      },
      boxShadow: {
        "monad": "0 0 25px rgba(131,110,249,0.25)",
        "monad-lg": "0 0 50px rgba(131,110,249,0.35)",
        "monad-xl": "0 0 80px rgba(131,110,249,0.2)",
        "card": "0 8px 32px rgba(0,0,0,0.5)",
        "card-hover": "0 16px 48px rgba(131,110,249,0.15)",
        "glow": "0 0 15px rgba(131,110,249,0.4), 0 0 45px rgba(131,110,249,0.1)",
        "inner-glow": "inset 0 1px 1px rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "float-delay": "float 6s ease-in-out 3s infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "fade-in": "fade-in 0.6s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "spin-slow": "spin 8s linear infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
