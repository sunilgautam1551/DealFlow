/**
 * The sales team. There is no login, so the person using the app is always
 * {@link CURRENT_USER_ID}; everyone else is a "teammate" whose edits arrive
 * through the realtime feed.
 */

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

/** The signed-in user (fixed, since login is out of scope). */
export const CURRENT_USER_ID = 'u01';

export const TEAMMATES: readonly User[] = USERS.filter((user) => user.id !== CURRENT_USER_ID);

const usersById = new Map(USERS.map((user) => [user.id, user]));

export function userName(id: string): string {
  return usersById.get(id)?.name ?? 'Unknown user';
}

/** "you" for the current user, otherwise the teammate's first name. */
export function displayActor(id: string): string {
  if (id === CURRENT_USER_ID) return 'you';
  return userName(id).split(' ')[0];
}
