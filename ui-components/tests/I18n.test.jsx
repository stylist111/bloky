import { beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterpolateTranslate } from "@components/I18n";
import { translateDummy } from "@/shared/i18n-helpers.js";

const content = {
  messageName: "Translate me, [[ name ]]",
  substitutions: "translator",
};
const tag = "em";

let translation;

const defaultProps = {
  content,
  translate: translateDummy,
  tag,
};

const renderTranslation = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };

  const baseButton = <InterpolateTranslate {...props} />;
  render(baseButton);
  translation = screen.getByTestId("interpolated-translation");
};

describe("InterpolateTranslate in default configuration", () => {
  beforeEach(() => {
    renderTranslation();
  });

  it("renders", () => {
    expect(translation).toBeVisible();
  });

  it("correctly substitutes the value", () => {
    const subDelimiterPattern = /\[\[|\]\]/; // matches [[ or ]]
    expect(translation).toHaveTextContent(content.substitutions);
    expect(translation).not.toHaveTextContent(subDelimiterPattern);
  });

  it("renders tag", () => {
    const taggedEl = translation.querySelector(tag);
    expect(taggedEl).toBeDefined();
  });

  it("renders tag with subsitution inside", () => {
    const taggedEl = translation.querySelector(tag);
    expect(taggedEl).toHaveTextContent(content.substitutions);
  });
});

describe("InterpolateTranslate with tagArgs", () => {
  const anchorTag = "a";
  const linkArgs = {
    href: "https://art.sarahghp.com",
    className: "text-theme-link-color underline",
  };

  beforeEach(() => {
    renderTranslation({
      tag: anchorTag,
      tagArgs: linkArgs,
    });
  });

  it("renders the tag with passed args", () => {
    const taggedEl = translation.querySelector(anchorTag);
    expect(taggedEl).toBeDefined();
    expect(taggedEl.getAttribute("href")).toBe(linkArgs.href);
    expect(taggedEl).toHaveClass(linkArgs.className);
  });
});

describe("InterpolateTranslate without substitutions", () => {
  const interpolatedText = "emphasized";
  const messageWithoutSubs = {
    messageName: `This is some very [[ ${interpolatedText} ]] text.`,
  };

  beforeEach(() => {
    renderTranslation({ content: messageWithoutSubs });
  });

  it("renders", () => {
    expect(translation).toBeVisible();
  });

  it("renders the tag with non-substituted text", () => {
    const taggedEl = translation.querySelector(tag);
    expect(taggedEl).toHaveTextContent(interpolatedText);
  });
});
