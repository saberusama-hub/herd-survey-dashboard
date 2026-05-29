'use client';

import { Slider } from '@/components/ui/Slider';

interface Props {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}

export function FYRangeSlider({ min, max, value, onChange }: Props) {
  return (
    <div className="space-y-2 min-w-[280px]">
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span className="font-medium">Fiscal Year range</span>
        <span className="tabular-nums">
          FY{value[0]} – FY{value[1]}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={value}
        onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
      />
    </div>
  );
}
