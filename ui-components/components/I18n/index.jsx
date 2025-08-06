import PropTypes from "prop-types";

/**
 * InterpolateTranslate is to be used when an HTML component, like a link or styled span,
 * should be interpolated into a translation. For cases without an interpolated component,
 * the host translate function can be used directly.
 *
 * @param {Object} props - The props for the InterpolateTranslate component.
 * @param {Object} props.content - Object containing messageName and optional subsitutions parameters
 *    for the translation. These correspond to the arguments expected by the translate function,
 *    which is currently a wrapper on browser.i18n.getMessage.
 * @param {string} props.tag - The tag in which to wrap the inner string. Any html tag
 *    or custom component should work.
 * @param {Object} [props.tagArgs] - Optional arguments to pass through to the tag. For instance,
 *    href for links or className values.
 * @param {Function} translate - The translation function defined in the host.
 * @returns {JSX.Element} The interpolate translate component.
 */
export const InterpolateTranslate = ({
  content,
  tag: Tag,
  tagArgs,
  translate,
}) => {
  const { messageName, substitutions } = content;
  const rawMessage = translate(messageName, substitutions);
  const pattern = /\[\[|\]\]/; // matches [[ or ]]
  const [before, inner, after] = rawMessage.split(pattern);

  return (
    <span data-testid="interpolated-translation">
      {" "}
      {before} <Tag {...tagArgs}> {inner} </Tag> {after}{" "}
    </span>
  );
};

InterpolateTranslate.propTypes = {
  content: PropTypes.object.isRequired,
  tag: PropTypes.string.isRequired,
  tagArgs: PropTypes.object,
  translate: PropTypes.func.isRequired,
};
