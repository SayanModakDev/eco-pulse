import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Zod Schema Validation Tests ──────────────────────────────────────────────

import {
  naturalLanguageInputSchema,
  profileContextSchema,
  trackRequestSchema,
} from '../utils/validators.js';

describe('Zod Schema Validations', () => {

  // ── naturalLanguageInputSchema ─────────────────────────────────────────

  describe('naturalLanguageInputSchema', () => {
    it('should accept a valid query with locale and timestamp', () => {
      const input = {
        query: 'What is the carbon footprint of driving?',
        locale: 'en-US',
        timestamp: '2026-06-18T12:00:00.000Z',
      };
      const result = naturalLanguageInputSchema.parse(input);
      assert.equal(result.query, 'What is the carbon footprint of driving?');
      assert.equal(result.locale, 'en-US');
    });

    it('should trim whitespace from query', () => {
      const result = naturalLanguageInputSchema.parse({ query: '   hello world   ' });
      assert.equal(result.query, 'hello world');
    });

    it('should reject an empty string query', () => {
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: '' }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('empty')));
          return true;
        }
      );
    });

    it('should reject a query exceeding 1000 characters', () => {
      const longQuery = 'a'.repeat(1001);
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: longQuery }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('1000')));
          return true;
        }
      );
    });

    it('should reject a non-string query', () => {
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: 12345 }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('string')));
          return true;
        }
      );
    });

    it('should reject invalid locale formats', () => {
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: 'test', locale: 'english' }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes('locale')));
          return true;
        }
      );
    });

    it('should accept query with only optional fields omitted', () => {
      const result = naturalLanguageInputSchema.parse({ query: 'hello' });
      assert.equal(result.locale, undefined);
      assert.equal(result.timestamp, undefined);
    });
  });

  // ── trackRequestSchema ─────────────────────────────────────────────────

  describe('trackRequestSchema', () => {
    it('should accept a valid track request with profile context', () => {
      const result = trackRequestSchema.parse({
        activityString: 'I drove 10km',
        profileContext: {
          userId: 'u1',
          email: 'a@b.com',
        },
      });
      assert.equal(result.activityString, 'I drove 10km');
      assert.equal(result.profileContext.userId, 'u1');
    });

    it('should accept a track request without profile context', () => {
      const result = trackRequestSchema.parse({
        activityString: 'I ate a salad',
      });
      assert.equal(result.profileContext, undefined);
    });

    it('should reject a missing activityString', () => {
      assert.throws(
        () => trackRequestSchema.parse({}),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes('activityString')));
          return true;
        }
      );
    });

    it('should reject an activityString exceeding 2000 characters', () => {
      assert.throws(
        () => trackRequestSchema.parse({ activityString: 'x'.repeat(2001) }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('too long')));
          return true;
        }
      );
    });

    it('should reject activityString containing only whitespace', () => {
      assert.throws(
        () => trackRequestSchema.parse({ activityString: '    ' }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('empty')));
          return true;
        }
      );
    });

    it('should pass through special characters in activityString safely', () => {
      const input = { activityString: 'I drove <script>alert("xss")</script> 10km' };
      const result = trackRequestSchema.parse(input);
      assert.ok(result.activityString.includes('<script>'));
    });
  });

  // ── profileContextSchema ───────────────────────────────────────────────

  describe('profileContextSchema', () => {
    it('should reject invalid email addresses', () => {
      assert.throws(
        () => profileContextSchema.parse({ userId: 'u1', email: 'not-email' }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes('email')));
          return true;
        }
      );
    });

    it('should apply default preferences when omitted', () => {
      const result = profileContextSchema.parse({ userId: 'u1', email: 'a@b.com' });
      assert.equal(result.preferences.theme, 'system');
      assert.equal(result.preferences.notificationsEnabled, true);
    });

    it('should reject negative dailyBaselineKg', () => {
      assert.throws(
        () => profileContextSchema.parse({
          userId: 'u1',
          email: 'a@b.com',
          dailyBaselineKg: -5,
        }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes('dailyBaselineKg')));
          return true;
        }
      );
    });

    it('should reject more than 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
      assert.throws(
        () => profileContextSchema.parse({ userId: 'u1', email: 'a@b.com', tags }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes('20')));
          return true;
        }
      );
    });
  });
});


// ─── Orchestrator & Agent Pipeline Tests ──────────────────────────────────────

import { orchestrateCarbonTracking } from '../agents/orchestrator.js';

describe('Agent Orchestrator Pipeline', () => {
  it('should process a standard activity string and return all required fields', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I drove 20km and ate a beef burger',
      profileContext: { userId: 'test', email: 't@t.com', dailyBaselineKg: 10 },
    });

    assert.ok(result.rawInput);
    assert.ok(Array.isArray(result.activities));
    assert.ok(result.activities.length > 0);
    assert.ok(result.summary);
    assert.equal(typeof result.summary.totalCo2eKg, 'number');
    assert.equal(result.summary.dailyBaselineKg, 10);
    assert.ok(['under_baseline', 'over_baseline'].includes(result.summary.status));
    assert.ok(Array.isArray(result.challenges));
    assert.ok(result.challenges.length > 0);
  });

  it('should handle an input with no recognizable activities gracefully', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I just had a wonderful day relaxing at home',
    });

    // Should fall back to generic activity
    assert.ok(result.activities.length > 0);
    assert.equal(typeof result.summary.totalCo2eKg, 'number');
  });

  it('should handle inputs with very large numbers without crashing', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I drove 999999999 km today',
    });

    assert.ok(result.activities.length > 0);
    assert.ok(result.summary.totalCo2eKg > 0);
    assert.equal(result.summary.status, 'over_baseline');
  });

  it('should correctly identify food as hotspot for beef activities', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I ate 3 beef burgers',
    });

    assert.ok(result.summary.hotspot);
    assert.equal(result.summary.hotspot.category, 'food');
    assert.ok(result.summary.hotspot.co2eKg > 0);
  });

  it('should assign zero emissions for cycling and walking', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I walked 5km and rode a bike for 10km',
    });

    // All transport activities should have zero emission factor
    const transportActivities = result.activities.filter(
      (a) => a.category === 'transport' && (a.description.includes('bike') || a.description.includes('walk'))
    );
    for (const act of transportActivities) {
      assert.equal(act.co2eKg, 0);
    }
  });

  it('should return challenges matching the hotspot category', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I drove my car for 50km',
    });

    assert.ok(result.challenges.length > 0);
    // Each challenge must have the required shape
    for (const challenge of result.challenges) {
      assert.ok(challenge.title);
      assert.ok(challenge.description);
      assert.equal(typeof challenge.potentialSavingKg, 'number');
      assert.ok(['easy', 'medium', 'hard'].includes(challenge.difficulty));
    }
  });

  it('should apply default baseline when profileContext is omitted', async () => {
    const result = await orchestrateCarbonTracking({
      activityString: 'I ate chicken',
    });

    assert.equal(result.summary.dailyBaselineKg, 15.0);
    assert.equal(result.profileApplied.userId, 'anonymous');
  });
});


// ─── Memory Cache Tests ──────────────────────────────────────────────────────

import MemoryCache, { emissionFactorCache } from '../utils/cache.js';

describe('MemoryCache Utility', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ ttlMs: 500, maxEntries: 3 });
  });

  it('should store and retrieve a value', () => {
    cache.set('key1', 'value1');
    assert.equal(cache.get('key1'), 'value1');
  });

  it('should return undefined for a non-existent key', () => {
    assert.equal(cache.get('missing'), undefined);
  });

  it('should expire entries after TTL', async () => {
    cache.set('ephemeral', 'data', 50); // 50ms TTL
    assert.equal(cache.get('ephemeral'), 'data');

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(cache.get('ephemeral'), undefined);
  });

  it('should evict the oldest entry when maxEntries is exceeded', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Cache is full (3 entries). Adding a 4th should evict 'a'.
    cache.set('d', 4);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('d'), 4);
  });

  it('should correctly report has() for existing and missing keys', () => {
    cache.set('present', true);
    assert.equal(cache.has('present'), true);
    assert.equal(cache.has('absent'), false);
  });

  it('should delete a specific key', () => {
    cache.set('toDelete', 'val');
    assert.equal(cache.delete('toDelete'), true);
    assert.equal(cache.get('toDelete'), undefined);
  });

  it('should clear all entries', () => {
    cache.set('x', 1);
    cache.set('y', 2);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('should return correct stats', () => {
    cache.set('s', 1);
    const stats = cache.stats();
    assert.equal(stats.size, 1);
    assert.equal(stats.maxEntries, 3);
    assert.equal(stats.ttlMs, 500);
  });
});

describe('emissionFactorCache singleton', () => {
  it('should be a MemoryCache instance with long TTL', () => {
    assert.ok(emissionFactorCache instanceof MemoryCache);
    const stats = emissionFactorCache.stats();
    assert.equal(stats.ttlMs, 60 * 60 * 1000); // 1 hour
  });
});
