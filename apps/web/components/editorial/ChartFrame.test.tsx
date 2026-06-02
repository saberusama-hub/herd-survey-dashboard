// react-dom/server resolves to a node-specific entry that vite-node has
// trouble locating; pull the browser-server build directly, which exports the
// same surface and works in vitest's vite-node loader. @types/react-dom
// doesn't declare the subpath, so suppress that one TS error.
// @ts-expect-error - react-dom/server.browser exists at runtime, no DT types
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { describe, expect, it } from 'vitest';
import { ChartFrame } from './ChartFrame';

/**
 * Server-rendered DOM-free unit test. The project does not currently include
 * `@testing-library/react` or `jsdom`, so we assert against the rendered HTML
 * string via `renderToStaticMarkup`. This keeps the test runtime simple
 * (vitest `node` environment, no DOM dependency).
 */
describe('ChartFrame', () => {
  it('renders eyebrow / title / dek / source line', () => {
    const html = renderToStaticMarkup(
      <ChartFrame eyebrow="Section 4" title="Federal funding" dek="By agency, FY2024" source="HERD Q09">
        <div data-testid="chart">chart</div>
      </ChartFrame>,
    );

    expect(html).toContain('Section 4');
    expect(html).toContain('<h3');
    expect(html).toContain('Federal funding');
    expect(html).toContain('By agency, FY2024');
    expect(html).toContain('HERD Q09');
    expect(html).toContain('data-testid="chart"');
    expect(html).toContain('Chart: Research Data Platform');
  });

  it('omits the figcaption footer when no source / note supplied', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="Bare chart">
        <div>chart</div>
      </ChartFrame>,
    );

    expect(html).toContain('Bare chart');
    expect(html).not.toContain('Source:');
    expect(html).not.toContain('Note:');
  });

  it('omits the eyebrow when not supplied', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="No eyebrow">
        <div>chart</div>
      </ChartFrame>,
    );

    expect(html).toContain('No eyebrow');
    expect(html).not.toContain('uppercase tracking-wider text-text-tertiary');
  });

  it('renders a (?) toggle button + aria attrs when methodology is supplied', () => {
    const html = renderToStaticMarkup(
      <ChartFrame
        title="Has methodology"
        methodology={{
          what: 'Plain-language description.',
          how: 'Sum of column X by FY.',
        }}
      >
        <div>chart</div>
      </ChartFrame>,
    );

    // Button rendered with correct aria semantics.
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="What this chart shows"');
    expect(html).toContain('aria-controls=');
    // Default-collapsed: the methodology copy must NOT appear in the SSR output.
    expect(html).not.toContain('Plain-language description.');
    expect(html).not.toContain('Sum of column X by FY.');
  });

  it('omits the (?) button when methodology is not supplied', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="No methodology">
        <div>chart</div>
      </ChartFrame>,
    );

    expect(html).not.toContain('aria-label="What this chart shows"');
  });
});
