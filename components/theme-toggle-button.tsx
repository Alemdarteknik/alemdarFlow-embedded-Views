"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

type ThemeToggleButtonProps = {
  variant?: "ghost" | "outline";
  size?: "icon" | "default" | "sm" | "lg";
  className?: string;
};

export function ThemeToggleButton({
  variant = "ghost",
  size = "icon",
  className,
}: ThemeToggleButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={className}
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

