import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import {
  buttonClassName,
  type ButtonSize,
  type ButtonVariant,
} from "./button";

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}
