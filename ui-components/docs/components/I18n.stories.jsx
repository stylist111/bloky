import { InterpolateTranslate } from "@components";
import { getArgsFromJSDoc } from "../helpers.js";
import { translateDummy } from "@/shared/i18n-helpers.js";

export default {
  title: "Components/InterpolateTranslate",
  component: InterpolateTranslate,
  argTypes: getArgsFromJSDoc(InterpolateTranslate),
  args: {
    content: {
      messageName: "Translate me, [[ name ]]",
      substitutions: "translator",
    },
    translate: translateDummy,
    tag: "span",
  },
};

const generateKinds = (args) => {
  const linkArgs = {
    href: "https://art.sarahghp.com",
    className: "text-theme-link-color underline",
  };

  return (
    <>
      <p>
        <InterpolateTranslate {...args} />
      </p>
      <p>
        <InterpolateTranslate {...args} tag="em" />
      </p>
      <p>
        <InterpolateTranslate {...args} tag="a" tagArgs={linkArgs} />
      </p>
    </>
  );
};

export const AllVariants = {
  render: generateKinds,
};
