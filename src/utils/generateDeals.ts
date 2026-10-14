import { USERS, type Deal, type StageId } from '../types/deal';
import { DAY_MS } from './dealUtils';

/**
 * Fake data. Seeded, so every run (and the demo video) shows the same deals.
 * With 50,000 deals, New Lead and Contacted hold ~10,000 each, as in the brief.
 */

// --- Random helpers -------------------------------------------------------------

export type RandomSource = () => number;

/** Mulberry32: a tiny seedable random number generator. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max]. */
export function randomInt(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pickOne<T>(random: RandomSource, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

// --- Deals ------------------------------------------------------------------------

/** Relative share of deals per stage. */
const STAGE_WEIGHTS: [StageId, number][] = [
  ['new', 20],
  ['contacted', 20],
  ['demo', 15],
  ['proposal', 12],
  ['negotiation', 8],
  ['won', 12],
  ['lost', 13],
];
const TOTAL_WEIGHT = STAGE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

const COMPANY_NAMES = [
  'Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Northwind', 'Contoso',
  'Fabrikam', 'Sahyadri', 'Kaveri', 'Nilgiri', 'Vindhya', 'Aravali', 'Konark', 'Hampi',
  'Malabar', 'Deccan', 'Indus', 'Ganga', 'Zenith', 'Monarch', 'Sterling', 'Bluebird',
  'Orbit', 'Lotus', 'Peacock', 'Banyan', 'Saffron', 'Monsoon',
];
const COMPANY_SUFFIXES = [
  'Corp', 'Labs', 'Systems', 'Technologies', 'Logistics', 'Foods', 'Retail', 'Pharma',
  'Textiles', 'Motors', 'Finance', 'Health', 'Energy', 'Media', 'Infra',
];
const CITIES = ['Mumbai', 'Pune', 'Bengaluru', 'Delhi', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi'];

function pickStage(random: RandomSource): StageId {
  let roll = random() * TOTAL_WEIGHT;
  for (const [stage, weight] of STAGE_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return stage;
  }
  return 'new';
}

/** One deal. `id` is the plain number as a string (see `Deal.id` for why). */
export function generateDeal(random: RandomSource, id: number, now: number, overrides: Partial<Deal> = {}): Deal {
  // Squaring/cubing the roll skews towards small values: many small deals, few
  // big ones; mostly recent contact, a few long silences.
  const licences = 5 + Math.floor(random() ** 2 * 495);
  const pricePerLicence = randomInt(random, 12, 28) * 500; // ₹6,000–₹14,000
  const ownerId = pickOne(random, USERS).id;
  const lastActivityAt = now - Math.floor(random() ** 3 * 180 * DAY_MS);

  return {
    id: String(id),
    company: `${pickOne(random, COMPANY_NAMES)} ${pickOne(random, COMPANY_SUFFIXES)} (${pickOne(random, CITIES)})`,
    licences,
    value: licences * pricePerLicence,
    ownerId,
    stage: pickStage(random),
    expectedCloseAt: now + randomInt(random, -30, 120) * DAY_MS,
    lastActivityAt,
    version: 1,
    updatedAt: lastActivityAt,
    updatedBy: ownerId,
    ...overrides,
  };
}

export function generateDeals(count: number, seed: number, now: number): Deal[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, (_, index) => generateDeal(random, index + 1, now));
}
