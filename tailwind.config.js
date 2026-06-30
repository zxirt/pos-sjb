/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Netral hangat (konteks toko bangunan: material, kraft)
        bg: "#f4f2ee",
        surface: "#ffffff",
        ink: { DEFAULT: "#1c1a17", soft: "#6b655c" },
        line: { DEFAULT: "#e0dcd3", strong: "#cdc7bb" },
        // Aksen tindakan + status
        accent: { DEFAULT: "#1f5f8b", dark: "#1a4f74", soft: "#e8f0f6" },
        good: { DEFAULT: "#2f7a4d", soft: "#e6f2ea" },
        warn: { DEFAULT: "#9a6a00", soft: "#fbf2dc" },
        danger: { DEFAULT: "#b23b3b", soft: "#f6e7e7" },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,26,23,.05), 0 6px 20px rgba(28,26,23,.06)",
      },
    },
  },
  plugins: [],
};
