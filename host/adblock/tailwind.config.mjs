export default {
  content: ["./adblock-betafish/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--extension-font-family)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
