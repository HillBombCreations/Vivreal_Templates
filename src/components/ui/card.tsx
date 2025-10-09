import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

type AsProp<T extends React.ElementType> = {
  as?: T;
};

type PolymorphicRef<T extends React.ElementType> =
  React.ComponentPropsWithRef<T>["ref"];

type PolymorphicComponentProps<T extends React.ElementType, Props = object> =
  Props &
  AsProp<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof Props | "as">;

type CardTitleProps<T extends React.ElementType> = PolymorphicComponentProps<
  T,
  {
    className?: string;
  }
>;

const CardTitle = React.forwardRef(function CardTitleInner(props, ref) {
  const { as, className, ...rest } = props as CardTitleProps<React.ElementType>;
  const Component = as || ("h3" as React.ElementType);

  return React.createElement(Component, {
    ref: ref as PolymorphicRef<React.ElementType>,
    className: cn("text-2xl font-semibold leading-none tracking-tight", className),
    ...rest,
  });
}) as unknown as <T extends React.ElementType = "h3">(
  props: CardTitleProps<T> & { ref?: PolymorphicRef<T> }
) => React.ReactElement | null;

(CardTitle as unknown as { displayName?: string }).displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
