'use client';

import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@mieweb/ui';
import type { BrandConfig } from '@mieweb/ui/brands';

const BRAND_OPTIONS = [
  { key: 'bluehive', label: '🐝 BlueHive' },
  { key: 'default', label: '⚪ Default' },
  { key: 'enterprise-health', label: '🏥 Enterprise Health' },
  { key: 'mieweb', label: '🟢 MIE Web' },
  { key: 'waggleline', label: '🍯 Waggleline' },
  { key: 'webchart', label: '🟠 WebChart' },
] as const;

type BrandKey = (typeof BRAND_OPTIONS)[number]['key'];

const STORAGE_KEY = 'timeharbor-brand';

function applyBrand(brand: BrandConfig) {
  const root = document.documentElement;

  // Primary color scale
  const scale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  for (const step of scale) {
    root.style.setProperty(`--mieweb-primary-${step}`, brand.colors.primary[step]);
  }

  // Semantic colors (light mode — dark mode handled via .dark/data-theme override)
  const semantics = brand.colors.light;
  root.style.setProperty('--mieweb-background', semantics.background);
  root.style.setProperty('--mieweb-foreground', semantics.foreground);
  root.style.setProperty('--mieweb-card', semantics.card);
  root.style.setProperty('--mieweb-card-foreground', semantics.cardForeground);
  root.style.setProperty('--mieweb-muted', semantics.muted);
  root.style.setProperty('--mieweb-muted-foreground', semantics.mutedForeground);
  root.style.setProperty('--mieweb-border', semantics.border);
  root.style.setProperty('--mieweb-input', semantics.input);
  root.style.setProperty('--mieweb-ring', semantics.ring);
  root.style.setProperty('--mieweb-destructive', semantics.destructive);
  root.style.setProperty('--mieweb-destructive-foreground', semantics.destructiveForeground);
  root.style.setProperty('--mieweb-success', semantics.success);
  root.style.setProperty('--mieweb-success-foreground', semantics.successForeground);
  root.style.setProperty('--mieweb-warning', semantics.warning);
  root.style.setProperty('--mieweb-warning-foreground', semantics.warningForeground);

  // Typography
  root.style.setProperty('--mieweb-font-sans', brand.typography.fontFamily.sans.join(', '));
  if (brand.typography.fontFamily.mono) {
    root.style.setProperty('--mieweb-font-mono', brand.typography.fontFamily.mono.join(', '));
  }

  // Border radius
  root.style.setProperty('--mieweb-radius-none', brand.borderRadius.none);
  root.style.setProperty('--mieweb-radius-sm', brand.borderRadius.sm);
  root.style.setProperty('--mieweb-radius-md', brand.borderRadius.md);
  root.style.setProperty('--mieweb-radius-lg', brand.borderRadius.lg);
  root.style.setProperty('--mieweb-radius-xl', brand.borderRadius.xl);
  root.style.setProperty('--mieweb-radius-2xl', brand.borderRadius['2xl']);
  root.style.setProperty('--mieweb-radius-full', brand.borderRadius.full);

  // Shadows
  root.style.setProperty('--mieweb-shadow-card', brand.boxShadow.card);
  root.style.setProperty('--mieweb-shadow-dropdown', brand.boxShadow.dropdown);
  root.style.setProperty('--mieweb-shadow-modal', brand.boxShadow.modal);
}

async function loadBrand(key: BrandKey): Promise<BrandConfig> {
  const { brands } = await import('@mieweb/ui/brands');
  return brands[key]();
}

interface BrandSwitcherProps {
  variant?: 'dropdown' | 'inline';
}

export default function BrandSwitcher({ variant = 'dropdown' }: BrandSwitcherProps) {
  const [activeBrand, setActiveBrand] = useState<BrandKey>('bluehive');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load persisted brand on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as BrandKey | null;
    if (stored && BRAND_OPTIONS.some((b) => b.key === stored)) {
      setActiveBrand(stored);
      loadBrand(stored).then(applyBrand);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = async (key: BrandKey) => {
    setActiveBrand(key);
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, key);
    const brand = await loadBrand(key);
    applyBrand(brand);
  };

  const activeLabel = BRAND_OPTIONS.find((b) => b.key === activeBrand)?.label ?? 'Theme';

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {BRAND_OPTIONS.map((brand) => (
          <Button
            key={brand.key}
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(brand.key)}
            className={`px-2.5 py-1.5 text-xs rounded-lg h-auto ${
              brand.key === activeBrand
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium ring-1 ring-primary-300 dark:ring-primary-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {brand.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
        aria-label={`Switch brand theme: ${activeLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Palette className="w-4 h-4" />
        <span className="hidden lg:inline">{activeLabel}</span>
      </Button>

      {open && (
        <ul
          role="listbox"
          aria-label="Brand themes"
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 overflow-hidden"
        >
          {BRAND_OPTIONS.map((brand) => (
            <li
              key={brand.key}
              role="option"
              aria-selected={brand.key === activeBrand}
              onClick={() => handleSelect(brand.key)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                brand.key === activeBrand
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {brand.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
