import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const typographyVariants = cva("", {
  variants: {
    variant: {
      h1: "font-heading text-4xl font-semibold tracking-tight sm:text-5xl",
      h2: "font-heading text-3xl font-semibold tracking-tight",
      h3: "font-heading text-2xl font-semibold tracking-tight",
      h4: "font-heading text-xl font-semibold tracking-tight",
      h5: "font-heading text-lg font-semibold tracking-tight",
      h6: "font-heading text-base font-semibold tracking-tight",
      p: "text-base leading-7",
      lead: "text-2xl",
      subtitle: "text-lg text-muted-foreground",
      caption: "text-sm text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

type TypographyVariant = NonNullable<
  VariantProps<typeof typographyVariants>["variant"]
>;

const defaultElement: Record<
  TypographyVariant,
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p"
> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  p: "p",
  lead: "p",
  subtitle: "p",
  caption: "p",
};

type TypographyProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  };

function Typography({
  className,
  variant = "p",
  as,
  ...props
}: TypographyProps) {
  const Component = as ?? defaultElement[variant ?? "p"];

  return (
    <Component
      data-slot="typography"
      className={cn(typographyVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Typography, typographyVariants };
