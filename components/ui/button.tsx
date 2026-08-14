import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva("inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-[var(--ink)] text-white shadow-sm hover:bg-[var(--ink-soft)]", primary: "bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-strong)]", outline: "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]", ghost: "hover:bg-[var(--surface-2)]", danger: "bg-red-600 text-white hover:bg-red-700" }, size: { default: "h-10", sm: "h-9 min-h-9 px-3", icon: "h-10 w-10 p-0" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) { return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />; }

