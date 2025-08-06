import { useState } from "react";
import { Story } from "@storybook/blocks";
import PropTypes from "prop-types";

/**
 * Renders the first story in all available themes for each extension.
 * @param {Array<{ extension: string, name: string }>} themes - List of theme objects.
 * @returns {JSX.Element}
 * @constructor
 */
export default function StoryAllThemes({ themes }) {
  const [backgroundColor, updateBackgroundColor] = useState("bg-theme-primary");
  const onThemeRadioChange = (evt) => {
    updateBackgroundColor(evt.target.value);
  };

  const baseClasses =
    "flex items-center justify-center gap-2 px-10 py-5 rounded";
  const displayClasses = [baseClasses, backgroundColor].join(" ");

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 id="preview-all-themes">All Themes</h3>
        <div className="flex items-center justify-end gap-x-2">
          <p>Background color:</p>
          <div className="flex items-center">
            <input
              type="radio"
              id="primary"
              name="bkg-color"
              value="bg-theme-primary"
              checked={backgroundColor === "bg-theme-primary"}
              onChange={onThemeRadioChange}
            />
            <label className="text-sm ml-1" htmlFor="primary">
              Primary
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              id="secondary"
              name="bkg-color"
              value="bg-theme-secondary"
              checked={backgroundColor === "bg-theme-secondary"}
              onChange={onThemeRadioChange}
            />
            <label className="text-sm ml-1" htmlFor="secondary">
              Secondary
            </label>
          </div>
        </div>
      </div>
      <p>
        Showcases the first story in all available themes for each extension.
        Note that some items are designed for one bckground color or the other,
        depending on if they are popup or options only, or designed for both.
      </p>

      {themes.map(({ extension, name }) => (
        <div key={`${extension}-${name}`}>
          <h5 className="font-bold">
            {extension} {name}
          </h5>
          <div
            data-extension={extension.toLowerCase()}
            data-theme={name.toLowerCase()}
            className={displayClasses}
          >
            <Story />
          </div>
        </div>
      ))}
    </div>
  );
}

StoryAllThemes.propTypes = {
  themes: PropTypes.arrayOf(
    PropTypes.shape({
      extension: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
};
