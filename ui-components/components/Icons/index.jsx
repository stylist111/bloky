import PropTypes from "prop-types";
import { useState, useEffect } from "react";

export const sizeToNumber = {
  sm: "18px",
  md: "24px",
  lg: "32px",
};

/**
 * Icons are pictures, made with svgs. They can be themed.
 *
 * @param {Object} props - The props for the Icon component.
 * @param {boolean} [props.ariaHidden] - Used to indicate an icon is not meaningful and may be hidden
 *    from screenreaders. Must be true if no ariaLabel is passed.
 * @param {string} [props.ariaLabel] - Used to label icon. Must be present if ariaHidden is false.
 * @param {string} [props.className] - Classes for icon wrapper. Can be used to provide fill and stroke colors.
 * @param {string} props.name - Name of icon to display. Matches filename in icons/svgs.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Icon size.
 * @returns {JSX.Element} The Icon component.
 */
export const Icon = ({
  ariaHidden,
  ariaLabel,
  className,
  name,
  size = "md",
}) => {
  if (!ariaLabel && !ariaHidden) {
    throw new Error(
      "Icons must have either an aria-label or be aria-hidden, if they have no semanitic meaning.",
    );
  }

  const [importedComponent, setImportedComponent] = useState(null);

  useEffect(() => {
    const importComponent = async () => {
      const module = await import(`./svgs/${name}.jsx`);
      const { default: IconSvg } = module;
      setImportedComponent(
        <IconSvg size={sizeToNumber[size]} label={ariaLabel} />,
      );
    };

    importComponent();
  }, [ariaLabel, size]);

  return (
    <span className={className} aria-hidden={ariaHidden}>
      {importedComponent}
    </span>
  );
};

Icon.propTypes = {
  ariaLabel: PropTypes.string,
  ariaHidden: PropTypes.bool,
  className: PropTypes.string,
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf(Object.keys(sizeToNumber)),
};
