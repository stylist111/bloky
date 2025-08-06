import { fn } from "@storybook/test";
import { ToggleSwitch } from "@components";
import { getArgsFromJSDoc } from "../helpers.js";

export default {
  title: "Components/ToggleSwitch",
  component: ToggleSwitch,
  argTypes: getArgsFromJSDoc(ToggleSwitch),
  args: {
    onChange: fn(),
  },
};

let lastId = 0;
const getRandomId = (name) => {
  lastId++;
  return `${name}_${lastId}`;
};

const generateKinds = (args) => {
  return (
    <>
      <div className="flex items-center gap-x-2 fill-theme-link-color">
        <ToggleSwitch {...args} id={getRandomId("notcheckeddefault")} />
        <ToggleSwitch {...args} id={getRandomId("checked")} checked={true} />
      </div>
      <div className="flex items-center gap-x-4 fill-theme-link-color ml-2.5 mt-4">
        <ToggleSwitch
          {...args}
          kind="inline"
          id={getRandomId("notcheckeddefault")}
        />
        <ToggleSwitch
          {...args}
          kind="inline"
          id={getRandomId("checked")}
          checked={true}
        />
      </div>
    </>
  );
};

export const AllVariants = {
  render: generateKinds,
};

/**
 * ToggleSwitch is used as a controlled input with `checked` and `onChange` properties.
 */
export const Basic = {
  args: {
    checked: true,
    id: "basic_toggle",
    onChange: fn(),
  },
};
