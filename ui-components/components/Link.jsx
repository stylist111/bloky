import PropTypes from "prop-types";

const kindStyles = {
  text: ["text-theme-link-color", "hover:text-theme-text-accent"],
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
};

export const linkKinds = Object.keys(kindStyles);

/**
 * Link component for html anchors.
 *
 * @param {Object} props - The props for the Link component.
 * @param {React.ReactNode} [props.children] - Children components.
 * @param {string} [props.href] - The URL that the link points to with different schemes supported by the browsers
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#href
 * @param {string} [props.target='_blank'] - Indicates where the href URL will be displayed.
 * Accepts the same values as the <a> element https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#target,
 * '_blank' will open the url in a new tab.
 * '_self' will open the url in the current browsing context,
 * @param {string} [props.kind='text'] - The type of link to display.
 * @param {Array<string>} [props.colorOverrides] - Classes to override the default theme
 *    colors of a button. Use only if switching to a defined kind absolutely
 *    will not work.
 *
 * @returns The Link component.
 */
export const Link = ({
  children,
  href,
  target = "_blank",
  kind = "text",
  colorOverrides,
}) => {
  const defaultStyles =
    kind === "text" ? [] : ["px-4", "py-2", "rounded-md", "!no-underline"];
  const transitionStyles = ["transition", "duration-200", "ease-in-out"];
  const customStyles = colorOverrides ?? kindStyles[kind];
  const className = [
    ...defaultStyles,
    ...transitionStyles,
    ...customStyles,
  ].join(" ");

  return (
    <a
      className={className}
      target={target}
      href={href}
      rel="noreferrer"
      referrerPolicy="no-referrer"
    >
      {children}
    </a>
  );
};

Link.propTypes = {
  children: PropTypes.node,
  href: PropTypes.string.isRequired,
  target: PropTypes.string,
  kind: PropTypes.oneOf(linkKinds),
  colorOverrides: PropTypes.arrayOf(PropTypes.string),
};
