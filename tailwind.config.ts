import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        Serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        Handwritten: ["var(--font-handwritten)", "ui-rounded", "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;

