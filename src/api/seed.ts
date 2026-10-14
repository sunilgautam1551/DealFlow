import type { Deal } from '../domain/deal';
import type { StageId } from '../domain/stages';
import { DAY_MS } from '../domain/time';
import { USERS } from '../domain/users';
import { createSeededRandom, pickOne, pickWeighted, randomInt, type RandomSource } from './random';

/**
 * Generates a realistic-looking pipeline. With 50,000 deals the distribution
 * below puts ~10,000 deals in New Lead and Contacted, as in the brief.
 */

const STAGE_WEIGHTS: readonly (readonly [StageId, number])[] = [
  ['new', 20],
  ['contacted', 20],
  ['demo', 15],
  ['proposal', 12],
  ['negotiation', 8],
  ['won', 12],
  ['lost', 13],
];

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

/** Deal ids are zero-padded so they sort naturally: d-000001, d-000002, … */
export function formatDealId(index: number): string {
  return `d-${String(index).padStart(6, '0')}`;
}

/** Creates a single new deal. Also used by the simulator when teammates add leads. */
export function generateDeal(
  random: RandomSource,
  index: number,
  now: number,
  overrides: Partial<Deal> = {},
): Deal {
  const company = `${pickOne(random, COMPANY_NAMES)} ${pickOne(random, COMPANY_SUFFIXES)} (${pickOne(random, CITIES)})`;
  // Squaring the roll skews towards small deals: most are small, a few are large.
  const licences = 5 + Math.floor(random() ** 2 * 495);
  const pricePerLicence = randomInt(random, 12, 28) * 500; // ₹6,000 – ₹14,000
  const ownerId = pickOne(random, USERS).id;
  // Cubing the roll makes recent activity common and long silences rare.
  const lastActivityAt = now - Math.floor(random() ** 3 * 180 * DAY_MS);

  return {
    id: formatDealId(index),
    company,
    licences,
    value: licences * pricePerLicence,
    ownerId,
    stage: pickWeighted(random, STAGE_WEIGHTS),
    expectedCloseAt: now + randomInt(random, -30, 120) * DAY_MS,
    lastActivityAt,
    version: 1,
    updatedAt: lastActivityAt,
    updatedBy: ownerId,
    ...overrides,
  };
}

/** Generates `count` deals deterministically from `seed`. */
export function generateDeals(count: number, seed: number, now: number): Deal[] {
  const random = createSeededRandom(seed);
  const deals: Deal[] = new Array(count);
  for (let i = 0; i < count; i++) {
    deals[i] = generateDeal(random, i + 1, now);
  }
  return deals;
}
