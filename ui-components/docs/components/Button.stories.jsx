import { fn } from "@storybook/test";
import { Button, buttonKinds, Icon } from "@components";
import { getArgsFromJSDoc } from "../helpers.js";

const icon = <Icon name="circle" size="sm" ariaHidden />;

export default {
  title: "Components/Button",
  component: Button,
  argTypes: getArgsFromJSDoc(Button),
  args: {
    text: "Update now",
    onClick: fn(),
  },
};

const generateKinds = (args) => {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {buttonKinds.map((el) => (
          <Button {...args} kind={el} key={el} />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        {buttonKinds.map((el) => (
          <Button {...args} kind={el} key={el} icon={icon} />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        {buttonKinds.map((el) => (
          <Button {...args} text="" kind={el} key={el} icon={icon} />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        {buttonKinds.map((el) => (
          <Button
            {...args}
            disabled
            kind={el}
            key={`disabled-${el}`}
            icon={icon}
          />
        ))}
      </div>
    </>
  );
};

export const AllVariants = {
  render: generateKinds,
};

/**
 * Filled buttons initiate the primary action of any given page or flow.
 * Avoid having more than one filled button available to the user at a
 * given time.
 */
export const Filled = {
  args: {
    text: "Update now",
  },
};

/**
 * Outline buttons usually serve as a secondary action button.
 */
export const Outline = {
  args: {
    text: "Update now",
    kind: "outline",
  },
};

/**
 * Text buttons have no outline or background. Often used for icon-only buttons.
 */
export const Text = {
  args: {
    kind: "text",
    text: "Update now",
  },
};

/**
 * Punched buttons give a the impression that the text is punched out of the button color.
 * It is often used for text buttons inline with icon-only buttons, such as in the popup header.
 */
export const Punched = {
  args: {
    kind: "punched",
    text: "Update now",
  },
};

/**
 * Link buttons are used in running text when an action that is not a navigation action is taken.
 * For instance, opening a tab from the popup, as opposed to moving to another page within the popup.
 */
export const Link = {
  args: {
    kind: "link",
    text: "Update now",
  },
};
