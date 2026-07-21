import { render } from "@react-email/render";
import { createElement } from "react";
import type { ComponentType } from "react";

export const renderEmailComponent = <T extends Record<string, unknown>>(
  Component: ComponentType<T>,
  props: T,
): Promise<string> => {
  const element = createElement(Component, props);
  return render(element);
};
