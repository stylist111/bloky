import PropTypes from "prop-types";
import { useState } from "react";

/**
 * Toggle Switches/Buttons allow users to enable or disable a setting, subscribe to a filter list.
 *
 * @param {Object} props - The props for the Toggle Switch component
 * @param {Boolean} [props.checked=false] - The initial state of the checked box
 * @param {string} props.id - ID of checkbox underlying Toggle Switch
 * @param {Function} props.onChange - The function to call when the Toggle Switch is clicked
 * @returns {JSX.Element} The Toggle Switch component
 */

export const INSET = "inset";
export const INLINE = "inline";

const stylesByKind = {
  [INSET]: {
    wrapperStyles: ["h-6 w-10"],
    buttonStyles: ["bg-theme-secondary"],
  },
  [INLINE]: {
    wrapperStyles: ["h-3 w-6", "bg-[--gray5]"],
    buttonStyles: ["bg-theme-link-color"],
  },
};

export const ToggleSwitch = ({
  id,
  onChange,
  checked = false,
  kind = INSET,
}) => {
  const [isChecked, setIsChecked] = useState(checked);

  const onChangeHandler = async (evt) => {
    setIsChecked(evt.target.checked);
    evt.target.blur();
    await onChange(evt);
  };

  // Override the internal state when external state changes
  // This allows simple implementations not to have to control the state
  // while allowing more complex interactions when needed.
  const [prevExternalChecked, setPrevExternalChecked] = useState(checked);
  if (checked !== prevExternalChecked) {
    setPrevExternalChecked(checked);
    setIsChecked(checked);
  }

  const checkedStylesByKind = {
    [INSET]: {
      wrapperStyles: [
        `${isChecked ? "bg-theme-link-color" : "bg-theme-accent-dark"}`,
      ],
      buttonStyles: [`${isChecked ? "translate-x-4" : "translate-x-0"}`],
    },
    [INLINE]: {
      wrapperStyles: [],
      buttonStyles: [
        `${isChecked ? "translate-x-3" : "-translate-x-3 bg-white border border-theme-secondary"}`,
      ],
    },
  };

  const defaultWrapperStyles = ["flex", "items-center", "rounded-full", "p-1"];
  const focusWrapperStyles = [
    "focus-within:outline-offset-2",
    "focus-within:outline-4",
    "focus-within:outline-[Highlight]",
    "focus-within:outline-auto",
  ];
  const wrapperStyles = [
    ...defaultWrapperStyles,
    ...focusWrapperStyles,
    ...stylesByKind[kind].wrapperStyles,
    ...checkedStylesByKind[kind].wrapperStyles,
  ].join(" ");

  const defaultToggleButtonStyles = [
    "h-4 w-4",
    "rounded-full",
    "shadow-sm",
    "duration-300",
  ];
  const toggleButtonStyles = [
    ...defaultToggleButtonStyles,
    ...stylesByKind[kind].buttonStyles,
    ...checkedStylesByKind[kind].buttonStyles,
  ].join(" ");

  // Same in both cases
  const hiddenButSelectable = "opacity-0 absolute peer";

  return (
    <label htmlFor={id} className="cursor-pointer flex items-center">
      <div className={wrapperStyles}>
        <input
          type="checkbox"
          id={id}
          onChange={onChangeHandler}
          defaultChecked={isChecked}
          className={hiddenButSelectable}
        />
        <div data-testid="toggleButton" className={toggleButtonStyles} />
      </div>
    </label>
  );
};

ToggleSwitch.propTypes = {
  checked: PropTypes.bool,
  id: PropTypes.string.isRequired,
  kind: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
