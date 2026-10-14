/**
 * Core definitions: what a deal is, the pipeline stages and the sales team.
 */

export type StageId = 'new' | 'contacted' | 'demo' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Stage {
  id: StageId;
  label: string;
  /** Won/Lost: the end of the pipeline, nothing left to work on. */
  isClosed: boolean;
}

/** In pipeline order. The order drives tab order and "next stage". */
export const STAGES: readonly Stage[] = [
  { id: 'new', label: 'New Lead', isClosed: false },
  { id: 'contacted', label: 'Contacted', isClosed: false },
  { id: 'demo', label: 'Demo Done', isClosed: false },
  { id: 'proposal', label: 'Proposal Sent', isClosed: false },
  { id: 'negotiation', label: 'Negotiation', isClosed: false },
  { id: 'won', label: 'Won', isClosed: true },
  { id: 'lost', label: 'Lost', isClosed: true },
];

/**
 * A potential sale. Deals are never edited in place: every change creates a
 * new object with a higher `version`.
 */
export interface Deal {
  /**
   * Integer-like string such as "42". This matters for speed: JavaScript
   * engines store integer-like object keys in a fast array-like structure, so
   * copying the 50,000-entry lookup object takes ~0.1 ms instead of ~20 ms.
   */
  id: string;
  company: string;
  licences: number;
  /** In rupees. */
  value: number;
  ownerId: string;
  stage: StageId;
  /** Epoch ms. */
  expectedCloseAt: number;
  /** Last time anyone touched the deal (epoch ms). */
  lastActivityAt: number;
  /** +1 on every server-side change. Lets the app ignore out-of-date updates. */
  version: number;
  updatedAt: number;
  /** User id of whoever made the latest change. */
  updatedBy: string;
}

export interface User {
  id: string;
  name: string;
}

export const USERS: readonly User[] = [
  { id: 'u01', name: 'Priya Sharma' },
  { id: 'u02', name: 'Rahul Verma' },
  { id: 'u03', name: 'Ananya Iyer' },
  { id: 'u04', name: 'Vikram Singh' },
  { id: 'u05', name: 'Meera Nair' },
  { id: 'u06', name: 'Arjun Reddy' },
  { id: 'u07', name: 'Kavya Menon' },
  { id: 'u08', name: 'Rohan Gupta' },
  { id: 'u09', name: 'Sneha Patil' },
  { id: 'u10', name: 'Aditya Rao' },
  { id: 'u11', name: 'Isha Kapoor' },
  { id: 'u12', name: 'Karan Malhotra' },
  { id: 'u13', name: 'Divya Joshi' },
  { id: 'u14', name: 'Nikhil Desai' },
  { id: 'u15', name: 'Pooja Bhat' },
  { id: 'u16', name: 'Siddharth Jain' },
  { id: 'u17', name: 'Neha Kulkarni' },
  { id: 'u18', name: 'Manish Tiwari' },
  { id: 'u19', name: 'Riya Chatterjee' },
  { id: 'u20', name: 'Farhan Sheikh' },
];

/** There is no login, so the person using the app is always Priya. */
export const CURRENT_USER_ID = 'u01';
