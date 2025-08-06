import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "@components";

let checkbox;
const clickFn = vi.fn();

const defaultProps = {
  onChange: clickFn,
};

const renderCheckbox = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };

  const element = <Checkbox {...props} />;
  render(element);
  checkbox = screen.getByRole("checkbox");
};

describe("Components / Checkbox", () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have role="checkbox" by default', () => {
    renderCheckbox();
    expect(checkbox).toBeVisible();
  });

  it("renders an unchecked `checkbox` by default", () => {
    renderCheckbox();
    expect(checkbox).to.have.property("checked", false);
  });

  it("renders an invalid `checkbox` when `invalid={true}`", () => {
    renderCheckbox({ invalid: true });
    expect(checkbox).toHaveClass("border-error");
  });

  it("renders an `checkbox` id when passed", () => {
    const id = "terms-and-conditions";
    renderCheckbox({ id });
    expect(checkbox).toHaveAttribute("id", id);
  });

  it("throws an error when `checked` is passed without `onChange`", () => {
    expect(() => renderCheckbox({ onChange: null })).toThrowError(
      "Checkbox is controlled but no `onChange` handler was provided.",
    );
  });

  it("responds to click events", () => {
    renderCheckbox();
    expect(clickFn).not.toHaveBeenCalled();
    expect(checkbox).to.have.property("checked", false);
    fireEvent.click(checkbox);
    expect(clickFn).toHaveBeenCalledTimes(1);
    expect(checkbox).to.have.property("checked", true);
  });
});
