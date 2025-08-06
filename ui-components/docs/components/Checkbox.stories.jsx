import { fn } from "@storybook/test";
import { Checkbox } from "@components";
import { getArgsFromJSDoc } from "@/docs/helpers.js";

export default {
  title: "Components/Checkbox",
  component: Checkbox,
  argTypes: getArgsFromJSDoc(Checkbox),
  args: {
    onChange: fn(),
  },
};

export const AllVariants = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox {...args} checked={false} />
      <Checkbox {...args} checked={true} />
    </div>
  ),
};

/**
 * Checkbox is used as a controlled input with `checked` and `onChange` properties.
 */
export const Basic = {
  args: {
    checked: true,
  },
};

/**
 * Invalid state is displayed using the `invalid` prop to indicate a failed
 * validation. You can use this style when integrating with form validation
 * libraries.
 */
export const Invalid = {
  args: {
    invalid: true,
  },
};
