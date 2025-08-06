import { fn } from "@storybook/test";
import { Button, Icon } from "@components";
import { getArgsFromJSDoc } from "../helpers.js";

export default {
  title: "Components/Icon",
  component: Icon,
  argTypes: getArgsFromJSDoc(Icon),
  args: {
    name: "circle",
    ariaLabel: "circles are mysterious",
  },
};

const generateKinds = (args) => {
  return (
    <div className="flex items-center gap-x-2 fill-theme-link-color">
      <Icon {...args} size="sm" />
      <Icon {...args} size="md" />
      <Icon {...args} size="lg" />
    </div>
  );
};

export const AllVariants = {
  render: generateKinds,
};

const renderInButton = () => {
  const icon = <Icon name="circle" size="sm" ariaHidden />;
  return <Button onClick={fn()} text="Hi, hello" icon={icon} />;
};

/**
 * Icons can appear in buttons. The button component will provide fill and stroke color.
 */
export const IconInButton = {
  render: renderInButton,
};
