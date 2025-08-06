import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Link } from "@components";

let link;
const defaultProps = {
  href: "https://example.com",
};

const renderLink = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };

  const element = <Link {...props}>Click Here</Link>;
  render(element);
  link = screen.getByRole("link");
};

describe("Link in default configuration", () => {
  beforeEach(async () => {
    await renderLink();
  });

  it("renders", async () => {
    await waitFor(() => expect(link).toBeVisible());
  });

  it("renders without passing referrer", async () => {
    await waitFor(async () => {
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link).toHaveAttribute("referrerPolicy", "no-referrer");
    });
  });
});

describe("Link kind variations", () => {
  it("renders the text-only variation", () => {
    renderLink();
    expect(link).toHaveClass("text-theme-link-color");
    expect(link).not.toHaveClass(/bg-/);
    expect(link).not.toHaveClass("border", /border-/);
  });

  it("renders the filled variation", () => {
    renderLink({ kind: "filled" });
    expect(link).toHaveClass("bg-theme-button-primary");
  });

  it("renders the outline variation", () => {
    renderLink({ kind: "outline" });
    expect(link).not.toHaveClass("bg-theme-button-primary");
    expect(link).toHaveClass("border border-theme-button-primary");
  });

  it("applies color overrides when used with hex values", () => {
    const colorOverrides = ["bg-[#bada55]"];
    renderLink({ colorOverrides });

    expect(link).toHaveClass(colorOverrides[0]);
    expect(link).not.toHaveClass("text-theme-link-color");
    expect(link).not.toHaveClass("bg-theme-button-primary");
    expect(link).not.toHaveClass("border", "border-theme-button-primary");
  });
});
