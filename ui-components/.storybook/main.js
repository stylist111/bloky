const config = {
  stories: ["../docs/**/*.mdx", "../docs/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "@storybook/addon-themes",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  // https://storybook.js.org/docs/api/main-config/main-config-docs
  docs: {
    autodocs: true, // Enables auto-generated documentation for all stories
    docsMode: true, // Only show documentation pages in the sidebar
  },
};

export default config;
