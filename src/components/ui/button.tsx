import { cn } from "@/lib/utils";
import {
  ButtonHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
} from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/10",
  outline:
    "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-700 hover:bg-slate-100",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** 包在 <a>/<Link> 內時改渲染 span，避免巢狀 button */
  as?: "button" | "span";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", as = "button", ...props },
    ref,
  ) => {
    const classes = cn(baseClass, variants[variant], sizes[size], className);

    if (as === "span") {
      const spanProps = props as HTMLAttributes<HTMLSpanElement>;
      return <span className={classes} {...spanProps} />;
    }

    return <button ref={ref} className={classes} {...props} />;
  },
);

Button.displayName = "Button";
