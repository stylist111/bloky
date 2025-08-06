import { useEffect } from "react";
import { DecoratorHelpers } from "@storybook/addon-themes";

const DEFAULT_ELEMENT_SELECTOR = "html";
const DEFAULT_DATA_EXTENSION_ATTRIBUTE = "data-extension";
const DEFAULT_DATA_THEME_ATTRIBUTE = "data-theme";
const { initializeThemeState, pluckThemeFromContext, useThemeParameters } =
  DecoratorHelpers;

export const withExtensionTheme = ({
  themes,
  defaultTheme,
  parentSelector = DEFAULT_ELEMENT_SELECTOR,
  attrExtName = DEFAULT_DATA_EXTENSION_ATTRIBUTE,
  attrThemeName = DEFAULT_DATA_THEME_ATTRIBUTE,
}) => {
  initializeThemeState(themes, defaultTheme);

  return (storyFn, context) => {
    const { themeOverride } = useThemeParameters();
    const selected = pluckThemeFromContext(context);

    useEffect(() => {
      const parentElement = document.querySelector(parentSelector);
      const extensionThemeKey = themeOverride || selected || defaultTheme;

      // Theme has the format "<Extension> <Theme>"
      const [extension, theme] = extensionThemeKey.split(" ");

      if (parentElement) {
        parentElement.setAttribute(attrExtName, extension.toLowerCase());
        parentElement.setAttribute(attrThemeName, theme.toLowerCase());
      }
    }, [themeOverride, selected]);

    return storyFn();
  };
};
