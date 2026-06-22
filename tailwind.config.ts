import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        paper: "#f7f7f2",
        line: "#d9ded6",
        moss: "#496b57",
        spruce: "#173f35",
        gold: "#b28b37",
        coral: "#c7624f",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 29, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
