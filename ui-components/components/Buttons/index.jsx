import PropTypes from "prop-types";

const kindStyles = {
  filled: [
    "bg-theme-button-primary",
    "text-theme-button-secondary",
    "fill-theme-button-secondary",
    "stroke-theme-button-secondary",
    "border",
    "border-theme-button-primary",
    "hover:drop-shadow-md",
    "hover:bg-theme-link-color",
    "hover:border-theme-link-color",
  ],
  outline: [
    "text-theme-button-primary",
    "fill-theme-button-primary",
    "stroke-theme-button-primary",
    "border",
    "border-theme-button-primary",
    "hover:bg-theme-button-primary",
    "hover:text-theme-button-secondary",
    "hover:stroke-theme-button-secondary",
    "hover:fill-theme-button-secondary",
  ],
  text: [
    "text-theme-accent-dark",
    "fill-theme-accent-dark",
    "stroke-theme-accent-dark",
    "hover:text-theme-link-color",
    "hover:fill-theme-link-color",
    "hover:stroke-theme-link-color",
  ],
  link: [
    "text-theme-link-color",
    "fill-theme-link-color",
    "stroke-theme-link-color",
    "inline",
    "hover:text-theme-text-accent",
    "hover:fill-theme-text-accent",
    "hover:stroke-theme-text-accent",
  ],
  punched: [
    "bg-theme-accent-dark",
    "text-theme-secondary",
    "fill-theme-secondary",
    "stroke-theme-secondary",
    "hover:bg-theme-link-color",
  ],
};

export const buttonKinds = Object.keys(kindStyles);

/**
 * Buttons allow users to take actions, and you can use them to direct a
 * user's attention or warn them of outcomes.
 *
 * @param {Object} props - The props for the Button component.
 * @param {Array<string>} [props.colorOverrides] - Classes to override the default theme
 *    colors of a button. Use only if switching to a defined kind absolutely
 *    will not work.
 * @param {boolean} [props.disabled] - Indicates if the button is disabled and makes it unable
 *    to be clicked or focused.
 * @param {JSX.Element} [props.icon] - An Icon component. Either text or an icon
 *    is required.
 * @param {Function} props.onClick - The function to call when the button is clicked.
 * @param {string} props.text - Text for the button. Either text or an icon
 *    is required.
 * @param {'filled'|'outline'|'text'|'link'|'punched'} [props.kind='filled'] -
 *    Type of button to display.
 * @param {string} [props.ariaLabel] - Aria label for the button. By default,
 *    uses the same text shown on the button.
 * @returns {JSX.Element} The button component.
 */
export const Button = ({
  colorOverrides,
  icon,
  onClick,
  text,
  ariaLabel = text,
  disabled = false,
  kind = "filled",
}) => {
  if (!icon && !text) {
    throw new Error("Buttons must have either an icon or text");
  }

  const defaultButtonStyles = [
    "flex justify-center",
    "px-4 py-2",
    "rounded-md",
  ];
  const defaultWrapperStyles = ["flex justify-center"];

  const disabledStyles = disabled ? ["opacity-50", "pointer-events-none"] : [];
  const disabledWrapperStyles = disabled ? ["cursor-not-allowed"] : [];

  const customStyles = colorOverrides ?? kindStyles[kind];
  const buttonStyles = [
    ...defaultButtonStyles,
    ...customStyles,
    ...disabledStyles,
  ].join(" ");
  const wrapperStyles = [
    ...defaultWrapperStyles,
    ...disabledWrapperStyles,
  ].join(" ");

  return (
    <div className={wrapperStyles}>
      <button
        type="button"
        aria-label={ariaLabel}
        className={buttonStyles}
        disabled={disabled}
        onClick={onClick}
      >
        <span className="flex justify-center items-center gap-x-2">
          {icon} {text}
        </span>
      </button>
    </div>
  );
};

Button.propTypes = {
  ariaLabel: PropTypes.string,
  colorOverrides: PropTypes.arrayOf(PropTypes.string),
  disabled: PropTypes.bool,
  icon: PropTypes.element,
  kind: PropTypes.oneOf(buttonKinds),
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string,
};
