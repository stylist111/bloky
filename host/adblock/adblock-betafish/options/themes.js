/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global settingsNotifier, settings, initializeProxies */

// Bloky: the stock page had 8 popup themes and 4 settings-page themes. Bloky has one
// "Appearance" choice for both: follow the system (default_theme), light or dark.
(function onThemesLoaded() {
  const choices = ["default_theme", "light_theme", "dark_theme"];

  const currentChoice = (colorThemes) => {
    const theme = colorThemes && colorThemes.options_page;
    return choices.includes(theme) ? theme : "default_theme";
  };

  const showChoice = (theme) => {
    document.querySelectorAll(".b-theme-input").forEach((input) => {
      // eslint-disable-next-line no-param-reassign
      input.checked = input.value === theme;
      input.closest(".b-theme").classList.toggle("selected", input.checked);
    });
  };

  $(async () => {
    await initializeProxies();
    showChoice(currentChoice(settings && settings.color_themes));

    document.querySelectorAll(".b-theme-input").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) {
          return;
        }
        // The settings proxy saves the whole object, so assign a fresh copy
        settings.color_themes = { popup_menu: input.value, options_page: input.value };
        showChoice(input.value);
        // apply right away, without reloading the page
        document.body.id = input.value;
        document.body.dataset.theme = input.value.replace("_theme", "");
      });
    });
  });

  settingsNotifier.on("settings.changed", (name, currentValue) => {
    if (name === "color_themes") {
      showChoice(currentChoice(currentValue));
    }
  });
})();
