# UI Component Library

Hello and welcome to our very under construction UI component library. The goal of this library is to provide basic UI components that can be assembled in various host and fragment components to create our extensions.

The notes below cover:

- [background & goals](#general-background-and-goals)
- [deciding what kind of component you need](#the-six-ways)
- [understanding what kinds of components should be in this library ](#is-this-the-right-place-for-my-component)
- [how to add a component to this library](#creating-a-component)
- [how to work with themes to provide a component for fragments and hosts](#working-alongside-host-code-adblock), including [how to do all of this incrementally as we go](#aligning-themed-css)

[More discussion of this project can be found in Google Docs.](https://docs.google.com/document/d/17Qg40bEA0CsZ_PUhIj7SB9LORKp_5cxDaWeHw6Kr0dk/edit)

> **Important note:** As we go, this may change, and that is ok! Please just chat with the team and update this README with useful info.

## General Background and Goals

The primary goal of our component and theming system is to produce UI components that can render themselves correctly, in terms of color, layout, and other design in both extensions, with multiple color themes. They should be able to do this **without the component writing conditionals based on the extension or theme name.** That is we would like to avoid code like this:

```js
// ⛔️ do not do this!

if (extension == "adblock" && theme == dark) {
  // apply CSS class or do other nefarious things or whatever
}
```

There are roughly six ways to achieve this. This repo is the right place for options 1 to 3.

### The Six Ways

_These are adapted from a more specific comment, but should be helpful here._

#### 1: Create a new theme variable.

This approach combines [CSS variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties) and [Tailwind Custom Styles](https://tailwindcss.com/docs/adding-custom-styles). It is what we did with the colors added in Tailwind in !35 and is what we did previously in Adblock, for example, with the `‌--popup-link-text-decoration`. To recapitulate that in `ui-components`, we would define the variable in the theme and then use it:

```js
	// in css themes
  [data-extension='adblock'][data-theme='watermelon'],
  [data-extension='adblock'] [data-theme='watermelon'] {
    --theme-primary: var(--red2);
    ‌--theme-text-accent: underline
		// more variables
  }

  // in Tailwind config

  theme: {
   extend: {
     colors: {
       "theme-primary": "var(--theme-primary)",
       ..
     },
     decoration: {
      "theme-text-accent": "var(--theme-text-accent)",
     }
   },
 },

  // in Link component

  <a class="decoration-theme-text-accent" ..> .. </a>

```

This is not ideal in the case of the link decoration because it leads to variable growth and it not highly reusable. It does work well for the colors because they are constrained in number, while widespread in use, especially with Tailwind using them to feel a large number of color-based classes.

#### 2: Add to theme as conventional CSS.

Tailwind does provide a way to use its classes as traditional CSS and this can be nested within a theme selector:

```js
  [data-extension='adblock'][data-theme='watermelon'],
  [data-extension='adblock'] [data-theme='watermelon'] {
    --theme-primary: var(--red2);
    // more variables

    a {
      @apply underline // this is how we use Tailwind classes in more trad CSS
    }
  }

```

This can be a good choice for typography, which should be the same everywhere unless explicitly overridden. It is good for simple, widespread behavior. This is what I would pick for link decoration.

#### 3: Passed as a variable from the surrounding context

For something like the blocked stats component, where in Adblock the labels are inline with the numbers and in ABP they are stacked, it is possible to let the call site pass a prop to indicate the difference.

```js
// in host/adblock/../button/popup-index.jsx
<BlockedStats labelLayout="inline" />

// in host/abp/../button/popup-index.jsx
<BlockedStats labelLayout="stacked" />

```

This works for cases where it differs based on the extension or the location in the extension, but not when it is determined by a color theme, like we have in Adblock. We should be judicious so that we don't create a whole separate layout system in Javascript, but I think it is a tool that might be right in cases such as this.

#### 4: Same components loaded in different orders

When hosts use the same components in different orders, this can be reflected in the hosts themselves. For instance, the order of premium toggles and blocked stats.

```js
// in host/adblock/../button/popup-index.jsx
<BlockedStats />
<PremiumToggles />

// in host/abp/../button/popup-index.jsx
<PremiumToggles />
<BlockedStats />

```

## 5: Different components loaded from each extension

```js
// in host/adblock/../button/popup-index.jsx
<BlockedStats />
<PremiumToggles />
<VeryComplexComponentForAdblock />


// in host/abp/../button/popup-index.jsx
<PremiumToggles />
<VeryComplexComponentForABP />
<BlockedStats />

```

In very complex cases, this might be the right answer, but see if the previous options won't work first.

#### 6: Work with design to make the distinction unnecessary.

If all the options are annoying, we can collaborate with our coworkers to update the design not to need a specific kind of variation. Talk to your designers or PMs!

## Is this the right place for my component?

The components in this library should cover basic functionality that can be expected to appear in both host extensions and/or a fragment. This can be something as small as buttons or as large as the blocked counts component — as long as they are display components or small action components that can function differently based on external functions or themed CSS differences.

These components should not rely on functions from the core utilities or manage state outside themselves. That means, they can expect translated text or action handlers, but otherwise should be self-contained.

If your component is 1, 2, or 3 solution and it is expected to be used as a building block for more complex feature components, it belongs here.

## File structure

This repo is organized to serve two parallel purposes: to contain the components ingested by the host directory (and their tests) and to document and display these components. The structure of the repo reflects both

```
├── components <------------------------- // Add your components here
│   ├── MyComponent.jsx
│   ├── index.jsx
├── tests <------------------------------ // Tests go here
│   ├── MyComponent.test.jsx
├── docs
│   ├── assets <--------------------- // Assets go here e.g. images
│   └── components <----------------- // Storybook components go here
│       └── MyComponent.stories.jsx
└── styles
    ├── adblock-color-themes.css <------- // Adblock color themes
    ├── extension-theme-abp.css <-------- // ABP theme specific styles
    └── extension-theme-adblock.css <---- // Adblock theme specific styles
```

## Component Development Workflow

When developing a new component, follow these steps to ensure consistency, proper documentation, and testing coverage:

1. [Creating a new Component](#creating-a-component)
2. [Add JSDoc and PropTypes](#add-jsdoc-and-proptypes)
3. [Write tests](#write-tests)
4. [Add to Storybook](#add-to-storybook)
5. [Add to Host/Fragment](#add-to-host)

### Creating a new Component

Create your component inside the `/components` directory.

Ensure the component follows the project’s architecture and style guidelines.

```jsx
// components/MyComponent.jsx
import PropTypes from "prop-types";

/**
 * This is my brand new awesome component.
 *
 * @param {object} props - The component props.
 * @param {string} text - The text to display.
 * @param {boolean} [isActive=false] - Whether the component is active.
 * @returns {JSX.Element}
 */
export default function MyComponent(text, isActive = false) {
  return (
    <div
      className={`bg-theme-primary ${isActive ? "text-theme-accent-dark" : "text-theme-secondary"}`}
    >
      {text}
    </div>
  );
}

MyComponent.propTypes = {
  text: PropTypes.string.isRequired,
  isActive: PropTypes.bool,
};
```

### Add JSDoc and PropTypes

All components should have JSDoc comments and PropTypes defined. This is essential for generating types and documentation.

JSDoc is used for generating types at the build time and PropTypes are used by Storybook in order to display the component's required props and their types.

> **Important:** Don't forget to add the `@params {object} props - The component props.` to the JSDoc comment, otherwise the types won't be generated properly.

### Write tests

All components should have unit tests associated with them. These can be placed in the `/tests` directory and named `Component.test.jsx`. (Note the `.jsx` — plain `.js` will throw.)

#### Tools for Running Tests

Running

```bash
npm run test
```

or `vitest` directly

```bash
vitest
```

starts a test watcher, which will rerun on file change.

Other commands for filtering, etc., are listed in [the vitest CLI guide](https://vitest.dev/guide/cli.html).

#### Tools for Writing Tests

For unit tests, we use [vitest](https://vitest.dev) with [React Testing Library](https://testing-library.com/docs/react-testing-library) and [@testing-library/jest-dom](https://github.com/testing-library/jest-dom).

**Vitest** provides the test APIs like [expect](https://vitest.dev/api/expect.html) and the [mocking functions](https://vitest.dev/api/vi.html#vi-fn).

**React Testing Library** provides [rendering](https://testing-library.com/docs/react-testing-library/api/#render), [events](https://testing-library.com/docs/dom-testing-library/api-events) and [querying](https://testing-library.com/docs/queries/about/) functions.

**jest-dom** provides [custom matchers for DOM assertions](https://www.npmjs.com/package/@testing-library/jest-dom#custom-matchers), like `toBeVisible`, `toContainElement`, `toHaveClass`, etc. Despite being called `jest-dom` it also works with Vitest.

#### Tips and Best Practices

This is a mostly unorganized series of good ideas. Feel free to add your own.

##### Creating a render function

Creating a set of default props and a function to render the component with these and any overwrites can make your tests easier to read and reduce repetition. Consider this example from `‌ui-components/tests/Buttons.test.jsx`

```jsx
let button;
const defaultProps = {
  text: buttonText,
  onClick: clickFn,
};

const renderButton = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };

  const baseButton = <Button {...props} />;
  render(baseButton);
  button = screen.getByRole("button");
};
```

Now when variations on the button are created, only the salient information needs to be included in the function:

```
renderButton({ kind: 'text' });
renderButton({ icon: <Icon /> });
```

> **Note:** Put values you are asserting against into variables as opposed to defining inline

Not only can this save us from repetition and uncaught mistakes, but it also makes it easier for readers of tests to understand the meaning of any given value. Remember: tests are great forms of documentation!

This is also supported by the `defaultProps` additions above, since it makes it easy to write tests like:

```jsx
expect(button).toHaveTextContent(defaultProps.text);
```

##### Test with indicative data as much as possible

A third step in making tests useful as possible for readers is to use real data or mocks that look like the expected data as much as possible.

##### Name tests clearly

Remember, most people will be interacting with your tests through the command line report and may not be familiar with implementation details. Being clear about what is being tested and what is expected to happen can help your coworkers.

```jsx
// ✅

describe("My cool component disabled", () => {
  beforeEach(() => {
    renderComponent({ disabled: true });
  });

  it("is not focusable when disabled", () => {
    expect(component).not.toBeFocused();
  });

  it("is not callable when disabled", () => {
    // ..
  });
});
```

> **Note:** Do not put too many expectations in one function

When a test block fails, the fewer assertions, the easier it is to understand what is failing. It is also easier to write a descriptive test name.

### Add to Storybook

Create a new file names `MyComponent.stories.jsx` in the `/docs/components` directory.

```jsx
// docs/components/MyComponent.stories.jsx
import { MyComponent } from "@components";
import { getArgsFromJSDoc } from "../helpers";

export default {
  // The <Group>/<Title> of the component to show in Storybook sidebar
  title: "Components/MyComponent",
  component: MyComponent,
  // Required for auto-populating props description from JSDoc.
  argTypes: getArgsFromJSDoc(MyComponent),
  args: {
    // Props you want to pass by default to your components
    text: "Hello World",
  },
};

/**
 * This description will appear under the Basic title in Storybook. The
 * first named export will be shown in all Themes.
 */
export const Basic = {
  args: {
    // overwrite the default args, if needed
    text: "Hello basic component",
  },
};

/**
 * This description will appear under the ActiveComponent
 * title in Storybook.This component will not be shown in theme
 * variations, like the Basic.
 */
export const ActiveComponent = {
  args: {
    isActive: true,
  },
};
```

### Add to Host/Fragment

Once the component is created, documented, and tested, it can be added to the host or fragment component.

```jsx
// e.g. host/adblock/src/OptionsContainer.jsx
import { MyComponent } from "@eyeo/ext-ui-components";

export default function OptionsContainer() {
  return (
    <main>
      <MyComponent text="Hello World" />
    </main>
  );
}
```

### Generating Types

Types are automatically generated from the JSDoc comments added to the component source files. Therefore, it's essential to provide thorough documentation. The types will be created during the build process when running `npm run build`.

### Theming

The goal of theming is to make it possible for a component to be styled correctly just by being instantiated in a host context that provides `data-extension` and `data-theme` attributes further up in the tree.

Hopefully, you will not need to create a theme variable to do your work, but will be able to use one that already exists. Especially as time goes on.

#### What Is a Theme?

The word _theme_ can be used in slightly different ways throughout discussions of UI work. This in part reflects that different systems use the word differently: for Tailwind, a theme is the portion of the configuration file where we ["define[our] project’s color palette, type scale, fonts, breakpoints, border radius values, and more"](https://tailwindcss.com/docs/theme), whereas in current Adblock code, _theme_ refers to the collection of properties — almost entirely to colors — that drive various views of the site.

In this new UI architecture, we are using _theme_ to refer to colors and properties, defined using methods 1 or 2, which are used to allow the same components to appear differently in different contexts, by which we mean not only Adblock themes but also as an Adblock or ABP component.

#### How to theme

Themes are created in the following manner:

##### 1: Adding a CSS variable with an extension and theme selector and theme name to the correct css file.

For example:

```css
[data-extension="adblock"][data-theme="default"],
[data-extension="adblock"] [data-theme="default"] {
  --theme-primary: var(--white);
}
```

Note that the name is not based on where it goes, like `popup-main-background` but instead on its use in a system, in this case, the primary theme color. This is because theme variables should be a small collection of properties that can be used many places.

Notice also that the selector indicates both the extension and the theme. Although it can be tempting to leverage defaults, being specific now can save us trouble later.

See [`ui-components/styles/adblock-color-themes.css`](https://gitlab.com/eyeo/extensions/extensions/-/tree/main/ui-components/styles/adblock-color-themes.css).

##### 2: Adding a reference to this variable in [`ui-components/tailwind.config.js`](https://gitlab.com/eyeo/extensions/extensions/-/tree/main/ui-components/tailwind.config.js)

For example:

```js
      colors: {
        "theme-primary": "var(--theme-primary)",
      },
```

##### 3: Using the related Tailwind class.

For instance, [color variables in Tailwind can be used in a number of classes](https://tailwindcss.com/docs/customizing-colors#using-custom-colors): in the [text color utilities](https://tailwindcss.com/docs/text-color), [border color utilities](https://tailwindcss.com/docs/border-color), and [background color utilities](https://tailwindcss.com/docs/background-color), among others.

For example:

```jsx
<div className="bg-theme-primary flex flex-wrap p-4">..</div>
```

## Working Alongside Host Code: CSS in General

The goal here is to slowly move to using Tailwind-generated CSS classes throughout the new architecture. To achieve that, all new components should be using the new themed classes and other Tailwind classes. But what about the old CSS?

> As components are replaced, please be sure to check the old CSS and remove classes that are no longer being used.

### Working Alongside Host Code: Adblock

#### Aligning Themed CSS

As the new theme styles use `data-*` attributes, the new CSS should not conflict with the old CSS.

However, as discussed in https://gitlab.com/eyeo/extensions/extensions/-/merge_requests/36#what-is-the-use-of-the-code-in-this-state-with-all-these-comments, through this project we are also constraining the variable-ized values that exist in the legacy CSS. In order to support moving forward while achieving a large change incrementally, the legacy CSS files have been organized to leave indications of the work still to be done as UI components are created and then integrated into host and fragment components.

The idea is that as we slowly replace current components with new ones, we have pointers as to which theme values to use for the new components and how much that changes the design.

In most cases, we should be able to add new components alongside old CSS and not have to change too much to keep them aligned. Changing the `dark_theme` `‌--extension-name-bg-color-hovered` from `‌--dark-gray1` to `--gray2` should not be a big deal, but by looking at the CSS, the developer can see that it has changed and should therefore double check that it is not illegible. And then the value can either be removed from the CSS — because it will no longer be used — or updated to match across old and new implementations.º

But sometimes changes will be bigger, and the organization and comments in this shows where we are deviating, so that we can make good choices. For instance, to be more semantically aligned across themes, within the `dark` theme `‌--popup-link-text: var(--red4);` should be changed to `‌--popup-link-text: var(--blue3);`. This is reflected in the CSS for whoever picks up the link component and they can confirm it makes sense and share with design.

In other cases, the outcome may be that we contract some instances but also reflect new categories in the `ui-components`.

Consider the `Button`.

As the start of implementation, the developer may expect the `Button` to have five `kind` options,ºº which align with the majority of cases and design best practices. However, we have some buttons where the color used is not the themed button color, so the developer also knows that providing a `colorOverride` prop to the new Button component will allow us to:

1. Notice where we are using a button outside the theme
2. Proceed with our work in parallel to working with design to determine whether we need another button kind / have found an unexpected case that can be converted to the default. For instance, we might decide that the premium yellow is important in Adblock and so there should be a `premium` kind of button that has that yellow included. But the `ancillary` buttons can be replaced by the `outline` variant.

The ultimate goal is that as we complete the move to the new UI framework, these files will get smaller and smaller, until they disappear. While the information could possibly be captured elsewhere, keeps it exactly where the decisions will be made.

### Working Alongside Host Code: AB

To integrate `ui-components` in AB you need to do the following steps:

1. Make sure you have built the `ui-components` package before you start.
2. Uncomment all the code marked with a `TODO (ui-components):`
3. Make sure you have the `ui-components` package installed in AB
4. Start changing code in `host/adblock/adblock-betafish/button/react-components`

Note: After we ship our first page in React with `ui-components` in AB, we should update the above steps.
