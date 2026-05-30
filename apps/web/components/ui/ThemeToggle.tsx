'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const label =
    theme === 'system' ? 'System theme' : resolvedTheme === 'dark' ? 'Dark theme' : 'Light theme';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label}. Click to change.`}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-accent-soft hover:text-accent"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
