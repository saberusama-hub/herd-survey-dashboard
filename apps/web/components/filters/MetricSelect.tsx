'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

export interface MetricOption {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  options: MetricOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}

export function MetricSelect({ options, value, onChange, label, placeholder = 'Choose metric…' }: Props) {
  return (
    <div className="space-y-2 min-w-[240px]">
      {label && <div className="text-xs text-text-secondary font-medium">{label}</div>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
