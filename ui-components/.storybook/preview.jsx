import {
  ArgTypes,
  Description,
  Primary,
  Stories,
  Subtitle,
  Title,
} from "@storybook/blocks";
import { themes } from "@/shared/constants.js";
import { withExtensionTheme } from "./ExtensionThemeDecorator.jsx";
import StoryAllThemes from "./StoryAllThemes.jsx";
import "@/styles/storybook.css";

const preview = {
  parameters: {
    // Optional parameter to center the component in the Canvas.
    // More info: https://storybook.js.org/docs/configure/story-layout
    layout: "centered",

    // Disable the background change button from toolbar
    backgrounds: {
      disable: true,
    },

    docs: {
      toc: true, // Enables the table of contents

      // Overwrite the default story with a custom template
      // to use ArgTypes instead of Controls and to add all themes
      page: () => (
        <>
          <Title />
          <Subtitle />
          <Description />
          <Primary />
          <ArgTypes />
          <Stories includePrimary={false} />
          <StoryAllThemes themes={themes} />
        </>
      ),
    },
  },

  decorators: [
    withExtensionTheme({
      themes: themes.map((theme) => `${theme.extension} ${theme.name}`),
      defaultTheme: `${themes[0].extension} ${themes[0].name}`,
    }),
  ],

  // Enables auto-generated documentation for all stories
  tags: ["autodocs"],
};

export default preview;
