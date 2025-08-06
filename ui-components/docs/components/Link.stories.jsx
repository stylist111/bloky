import { Link, linkKinds } from "@components";
import { getArgsFromJSDoc } from "@/docs/helpers.js";

export default {
  title: "Components/Link",
  component: Link,
  argTypes: getArgsFromJSDoc(Link),
  args: {
    href: "https://example.com",
  },
};

export const AllVariants = {
  render: (args) => (
    <div className="flex items-center gap-6">
      {linkKinds.map((el) => (
        <Link {...args} kind={el} key={el}>
          Click Here
        </Link>
      ))}
      <Link
        kind="filled"
        colorOverrides={["bg-purple-500", "text-white", "hover:bg-purple-600"]}
        {...args}
      >
        Click Here
      </Link>
    </div>
  ),
};
