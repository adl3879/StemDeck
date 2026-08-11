import type { ReactElement } from "react";
import type { Theme } from "../hooks/useTheme";
import { IconAuto, IconSun, IconMoon } from "./icons/Icons";

const NEXT: Record<Theme, Theme> = {
  auto: "light",
  light: "dark",
  dark: "auto",
};

const ICON: Record<Theme, (p: { className?: string }) => ReactElement> = {
  auto: IconAuto,
  light: IconSun,
  dark: IconMoon,
};

interface ThemeToggleProps {
  theme: Theme;
  onChange: (t: Theme) => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const Icon = ICON[theme];

  return (
    <button
      className="theme-toggle-btn"
      onClick={() => onChange(NEXT[theme])}
      aria-label={`Theme: ${theme}. Tap to switch.`}
    >
      <Icon />
    </button>
  );
}
