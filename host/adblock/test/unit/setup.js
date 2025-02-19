import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import * as mockGlobals from "./mocks/globals";
import * as mockUtils from "./mocks/utils";

// Make matchers from jest-dom available
expect.extend(matchers);

// Set up mocks for functions accessed globally
vi.mock("../../adblock-betafish/options/react-components/shared/globals.js", () => mockGlobals);
vi.mock("../../adblock-betafish/options/react-components/shared/utils.js", () => mockUtils);
