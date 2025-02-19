import { vi } from "vitest";
import translations from "../../../_locales/en_US/messages.json";

// eslint-disable-next-line arrow-body-style
const findMessage = (messageName) => {
  return translations[messageName].message || translations[messageName] || messageName;
};

export const translate = vi.fn(findMessage);
