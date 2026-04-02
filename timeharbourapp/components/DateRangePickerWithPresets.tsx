'use client';

import { DateRangePicker, type DateRangePickerProps } from '@mieweb/ui';
import { dateFilterPresets } from '@/lib/datePresets';

type Props = DateRangePickerProps;

/**
 * Wraps @mieweb/ui DateRangePicker and adds mobile-visible preset chips.
 * The library's responsive variant hides the preset sidebar below `md`,
 * so we render them as a horizontal scroll row on small screens.
 */
export function DateRangePickerWithPresets({
  activePreset,
  onChange,
  presets = dateFilterPresets,
  ...rest
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {/* Mobile-only preset chips — hidden on md+ where the calendar sidebar shows them */}
      <div className="flex gap-2 overflow-x-auto md:hidden" role="group" aria-label="Date range presets">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ start: null, end: null }, p.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activePreset === p.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <DateRangePicker
        activePreset={activePreset}
        onChange={onChange}
        presets={presets}
        {...rest}
      />
    </div>
  );
}
