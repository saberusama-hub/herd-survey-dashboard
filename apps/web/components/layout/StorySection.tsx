'use client';

import { cn } from '@/lib/utils';
import scrollama from 'scrollama';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface StoryStep {
  /** Unique id used as React key. */
  id: string;
  /** Markdown-allowed prose for this step. Keep it focused (~80–200 words). */
  content: ReactNode;
}

interface Props {
  /** Sticky chart rendered to the left/right of the scrolling text. */
  chart: (activeStepId: string) => ReactNode;
  steps: StoryStep[];
  /** Layout direction. */
  align?: 'right' | 'left';
  /** Background tone for the sticky panel. */
  chartBg?: string;
  className?: string;
}

/**
 * Scrollytelling primitive — text scrolls past a sticky chart; current step
 * is reported back via the `chart` render-prop.
 *
 * Spec section 5.10 / 6.4 — used by the three Story pages.
 */
export function StorySection({ chart, steps, align = 'right', chartBg, className }: Props) {
  const [activeId, setActiveId] = useState(steps[0]?.id ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = scrollama();
    sc.setup({
      step: `[data-story-step="${containerRef.current.dataset.storyId}"]`,
      offset: 0.5,
      threshold: 4,
    }).onStepEnter(({ element }: { element: HTMLElement }) => {
      const id = element.getAttribute('data-step-id');
      if (id) setActiveId(id);
    });
    const onResize = () => sc.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      sc.destroy();
    };
  }, []);

  const storyId = useRef(`story-${Math.random().toString(36).slice(2, 9)}`).current;

  return (
    <div
      ref={containerRef}
      data-story-id={storyId}
      className={cn(
        'relative grid grid-cols-1 lg:grid-cols-12 gap-8',
        align === 'left' ? 'lg:grid-flow-col-dense' : '',
        className,
      )}
    >
      <div
        className={cn(
          'lg:col-span-7 space-y-[80vh] pt-[20vh] pb-[20vh]',
          align === 'left' ? 'lg:col-start-6' : '',
        )}
      >
        {steps.map((s) => (
          <section
            key={s.id}
            data-story-step={storyId}
            data-step-id={s.id}
            className={cn(
              'rounded-lg border border-rule bg-surface-elevated p-6 lg:p-8 transition-opacity',
              activeId === s.id ? 'opacity-100 shadow-card-hover' : 'opacity-60',
            )}
          >
            {s.content}
          </section>
        ))}
      </div>

      <aside
        className={cn(
          'lg:col-span-5',
          align === 'left' ? 'lg:col-start-1 lg:row-start-1' : '',
        )}
      >
        <div
          className={cn(
            'lg:sticky lg:top-24 rounded-lg border border-rule p-4',
            chartBg ? '' : 'bg-surface-elevated',
          )}
          style={chartBg ? { background: chartBg } : undefined}
        >
          {chart(activeId)}
        </div>
      </aside>
    </div>
  );
}
