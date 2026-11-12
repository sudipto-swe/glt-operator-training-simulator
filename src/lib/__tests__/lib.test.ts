/**
 * Lib tests: CSV escaping + injection safety, storage abstraction,
 * records schema migration, skill bookkeeping and demo-cohort determinism.
 */
import { describe, expect, it } from 'vitest';
import { toCsv } from '../csv';
import { loadJson, memoryStorage, saveJson } from '../storage';
import {
  applyAttemptToSkills,
  emptySkills,
  migrateAndValidate
} from '../../state/recordsSchema';
import { buildDemoData } from '../../data/demoCohort';

describe('toCsv', () => {
  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"', 'line1\nline2']]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi""","line1\nline2"');
  });

  it('prefixes formula-like cells to block spreadsheet injection', () => {
    const csv = toCsv(['cmd'], [['=cmd|\' /C calc'], ['+SUM(A1:A2)'], ['-1'], ['@x'], ['plain']]);
    expect(csv).toContain("'=cmd|' /C calc");
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain("'-1");
    expect(csv).toContain("'@x");
    expect(csv).toContain('plain');
  });

  it('renders null and numbers cleanly', () => {
    const csv = toCsv(['n', 'v'], [[1, null], [2.5, true]]);
    expect(csv).toBe('n,v\r\n1,\r\n2.5,true');
  });
});

describe('storage', () => {
  it('round-trips JSON through the memory backend', () => {
    const mem = memoryStorage();
    saveJson(mem, 'k', { a: 1 });
    expect(loadJson(mem, 'k')).toEqual({ a: 1 });
    mem.removeItem('k');
    expect(loadJson(mem, 'k')).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const mem = memoryStorage();
    mem.setItem('bad', '{not json');
    expect(loadJson(mem, 'bad')).toBeNull();
  });
});

describe('records schema', () => {
  it('accepts valid data and rejects garbage', () => {
    const demo = buildDemoData(1700000000000);
    expect(migrateAndValidate(demo)).not.toBeNull();
    expect(migrateAndValidate({ hello: 'world' })).toBeNull();
    expect(migrateAndValidate(null)).toBeNull();
  });

  it('migrates the legacy v0 shape', () => {
    const legacy = { trainees: [] };
    const migrated = migrateAndValidate(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(1);
    expect(migrated?.attempts).toEqual([]);
  });

  it('applyAttemptToSkills only raises levels on assess passes', () => {
    const skills = emptySkills();
    const attempt = {
      id: 'a1',
      traineeId: 't1',
      scenarioId: 'S2',
      mode: 'assess' as const,
      startedAt: '2026-01-01T00:00:00.000Z',
      durationSec: 400,
      score: 80,
      passed: true,
      breakdown: null,
      critical: null,
      checklistPct: 90
    };
    const next = applyAttemptToSkills(skills, attempt);
    expect(next.loto.level).toBe(3); // S2 maps to the LOTO skill, 80 -> level 3
    expect(next.loto.lastCert).toBe(attempt.startedAt);
    // A lower score never lowers the level.
    const lower = applyAttemptToSkills(next, { ...attempt, score: 50 });
    expect(lower.loto.level).toBe(3);
    // Learn attempts never touch skills.
    const learn = applyAttemptToSkills(lower, { ...attempt, mode: 'learn' as const, score: null });
    expect(learn.loto.level).toBe(3);
  });
});

describe('demo cohort', () => {
  const NOW = 1750000000000;

  it('is deterministic for a fixed clock', () => {
    const a = buildDemoData(NOW);
    const b = buildDemoData(NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('contains 12 trainees with plausible history and valid skills', () => {
    const demo = buildDemoData(NOW);
    expect(demo.trainees).toHaveLength(12);
    expect(demo.attempts.length).toBeGreaterThan(60);
    for (const t of demo.trainees) {
      for (const rec of Object.values(t.skills)) {
        expect(rec.level).toBeGreaterThanOrEqual(0);
        expect(rec.level).toBeLessThanOrEqual(4);
      }
    }
    const assess = demo.attempts.filter((a) => a.mode === 'assess');
    expect(assess.length).toBeGreaterThan(30);
    expect(assess.every((a) => a.score != null)).toBe(true);
    // Some trainees have passed quizzes so assess is demonstrably unlockable.
    expect(demo.trainees.some((t) => t.passedQuizzes.length > 0)).toBe(true);
  });
});
