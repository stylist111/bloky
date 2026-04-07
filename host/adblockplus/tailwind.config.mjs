export default {
  content: ["./src/**/*.{html,js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--extension-font-family)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
