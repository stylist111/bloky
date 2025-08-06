import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@components/Buttons";

const buttonText = "I am the button";
const clickFn = vi.fn();

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

describe("Button in default configuration", () => {
  beforeEach(() => {
    renderButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders", () => {
    expect(button).toBeVisible();
  });

  it("renders the filled button by default", () => {
    expect(button).toHaveClass("bg-theme-button-primary");
  });

  it("renders text", () => {
    expect(button).toHaveTextContent(defaultProps.text);
  });

  it("uses text as the default aria label", () => {
    expect(button).toHaveTextContent(defaultProps.text);
  });

  it("calls the passed function on click", () => {
    expect(clickFn).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(clickFn).toHaveBeenCalledTimes(1);
  });

  // Note: This is useful in contrast to the test of the disabled state below
  it("is focusable", () => {
    button.focus();
    expect(button).toHaveFocus();
  });
});

describe("Button kind variations", () => {
  it("renders the outline variation", () => {
    renderButton({ kind: "outline" });
    expect(button).not.toHaveClass("bg-theme-button-primary");
    expect(button).toHaveClass("border border-theme-button-primary");
  });

  it("renders the text-only variation", () => {
    renderButton({ kind: "text" });
    expect(button).toHaveClass("text-theme-accent-dark");
    expect(button).not.toHaveClass(/bg-/);
    expect(button).not.toHaveClass("border", /border-/);
  });

  it("renders the link variation", () => {
    renderButton({ kind: "link" });
    expect(button).toHaveClass("text-theme-link-color", "inline");
    expect(button).not.toHaveClass(/bg-/);
    expect(button).not.toHaveClass("border", /border-/);
  });

  it("renders the punched variation", () => {
    renderButton({ kind: "punched" });
    expect(button).toHaveClass("bg-theme-accent-dark");
  });

  it("renders the filled variation when passed explicitly", () => {
    renderButton({ kind: "filled" });
    expect(button).toHaveClass("bg-theme-button-primary");
  });
});

describe("Button with optional parameters", () => {
  it("overwrites text when distinct aria label is passed", () => {
    const ariaLabel = "important-aardvark";
    renderButton({ ariaLabel });

    expect(button).toHaveAttribute("aria-label", ariaLabel);
    expect(button).not.toHaveAttribute("aria-label", defaultProps.text);
  });

  it("applies color overrides when used with hex values", () => {
    const colorOverrides = ["bg-[#bada55]"];
    renderButton({ colorOverrides });

    expect(button).toHaveClass(colorOverrides[0]);
    expect(button).not.toHaveClass("bg-theme-button-primary");
    expect(button).not.toHaveClass("text-theme-button-secondary");
    expect(button).not.toHaveClass("border", "border-theme-button-primary");
  });

  it("applies color overrides when used with theme values", () => {
    const colorOverrides = ["bg-[var(--theme-secondary)]"];
    renderButton({ colorOverrides });

    expect(button).toHaveClass(colorOverrides[0]);
    expect(button).not.toHaveClass("bg-theme-button-primary");
    expect(button).not.toHaveClass("text-theme-button-secondary");
    expect(button).not.toHaveClass("border", "border-theme-button-primary");
  });

  it("applies color overrides when used with color variable values", () => {
    const colorOverrides = ["text-[var(--solarized-teal3)]"];
    renderButton({ colorOverrides });

    expect(button).toHaveClass(colorOverrides[0]);
    expect(button).not.toHaveClass("bg-theme-button-primary");
    expect(button).not.toHaveClass("text-theme-button-secondary");
    expect(button).not.toHaveClass("border", "border-theme-button-primary");
  });
});

describe("Disabled button", () => {
  beforeEach(() => {
    renderButton({ disabled: true });
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call onClick when clicked", () => {
    expect(clickFn).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(clickFn).not.toHaveBeenCalled();
  });

  it("is not focusable", () => {
    button.focus();
    expect(button).not.toHaveFocus();
  });
});

describe("Icon button", () => {
  const iconId = "circle-icon";
  const Icon = () => (
    <svg
      data-testid={iconId}
      width="24px"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" />
    </svg>
  );

  it("renders both icon and text", () => {
    renderButton({ icon: <Icon /> });
    expect(button).toContainElement(screen.getByTestId(iconId));
    expect(button).toHaveTextContent(defaultProps.text);
  });

  it("renders icon only", () => {
    renderButton({ icon: <Icon />, text: "" });
    expect(button).toContainElement(screen.getByTestId(iconId));
    expect(button).not.toHaveTextContent(defaultProps.text);
  });
});

describe("Error states", () => {
  it("throws if neither text nor an icon is provided", () => {
    expect(() => renderButton({ text: null, icon: null })).toThrowError(
      "Buttons must have either an icon or text",
    );
  });
});
