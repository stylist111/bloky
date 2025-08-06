import { parse as parseJSDoc } from "comment-parser";

/**
 * Get the args from the JSDoc comments of a component.
 *
 * Storybook is using react-docgen to parse the JSDoc comments of a component,
 * which doesn't work properly with tags like @param and as result the
 * component description is not parsed correctly.
 */
export function getArgsFromJSDoc(component) {
  const description = component?.__docgenInfo?.description;
  const args = {};

  if (description) {
    const [info] = parseJSDoc(`/** ${description} */`);

    // Storybook uses react-docgen to parse the JSDoc comments, which doesn't
    // support JSDoc tags like @param, @returns, etc.
    // We overwrite the description to remove these tags, after we parsed
    // them and update the meta.argTypes.
    component.__docgenInfo.description = info.description;
    for (const tag of info.tags) {
      // Skip tags that aren't 'param'
      if (tag.tag !== "param") {
        continue;
      }

      // Use a regex to remove the 'props.' prefix if it exists
      const paramName = tag.name.replace(/^props\./, "");

      // Skip if the param name is 'props' after potential replacement
      if (paramName === "props") {
        continue;
      }

      args[paramName] = {
        ...args[paramName],

        // Only update the description as we don't want to overwrite the parameter
        // type, required, etc. that Storybook already parsed from PropTypes.
        description: tag.description,
      };
    }
  }

  return args;
}
