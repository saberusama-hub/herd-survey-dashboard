import { describe, expect, it, vi } from 'vitest';

// Mock the duckdb module BEFORE importing queries so the import-time bindings
// pick up the mocked `query` function. The mocked `query` returns a canned
// row shape used by `searchInstitutions`.
vi.mock('./duckdb', () => ({
  query: vi.fn().mockResolvedValue([
    { sk: 'INST0000123', name: 'Johns Hopkins University', state: 'MD' },
  ]),
  queryOne: vi.fn(),
}));

import { searchInstitutions } from './queries';

describe('searchInstitutions (P1.18)', () => {
  it('returns rows with { sk, name, state } shape', async () => {
    const rows = await searchInstitutions('hopkins');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sk: 'INST0000123',
      name: 'Johns Hopkins University',
      state: 'MD',
    });
  });
});
