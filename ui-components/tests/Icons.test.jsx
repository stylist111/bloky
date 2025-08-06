import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Icon, sizeToNumber } from "@components/Icons";

const name = "circle";
const ariaLabel = "buttons are mysterious";
const testId = "svg-icon-circle";

let icon;
const defaultProps = {
  name,
  ariaLabel,
};

const renderIcon = async (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };

  const baseIcon = <Icon {...props} />;
  render(baseIcon);
  icon = await screen.findByTestId(testId);
};

describe("Icon in default configuration", () => {
  beforeEach(async () => {
    await renderIcon();
  });

  it("renders", async () => {
    await waitFor(() => expect(icon).toBeVisible());
  });

  it("reders medium width by default", async () => {
    const width = sizeToNumber["md"];
    await waitFor(() => {
      const iconWidth = icon.getAttribute("width");
      expect(iconWidth).toBe(width);
    });
  });

  it("renders ariaLabel as title", async () => {
    await waitFor(async () => {
      const title = icon.querySelector("title");
      expect(title).toHaveTextContent(ariaLabel);
    });
  });
});

describe("Icon at other sizes", () => {
  it("reders small width when passed sm", async () => {
    const size = "sm";
    await renderIcon({ size });

    const width = sizeToNumber[size];
    await waitFor(() => {
      const iconWidth = icon.getAttribute("width");
      expect(iconWidth).toBe(width);
    });
  });

  it("reders large width when passed lg", async () => {
    const size = "lg";
    await renderIcon({ size });

    const width = sizeToNumber[size];
    await waitFor(() => {
      const iconWidth = icon.getAttribute("width");
      expect(iconWidth).toBe(width);
    });
  });
});

describe("Error states", () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if neither text nor an icon is provided", () => {
    expect(() => renderIcon({ ariaLabel: null })).rejects.toThrowError(
      "Icons must have either an aria-label or be aria-hidden, if they have no semanitic meaning.",
    );
  });
});
