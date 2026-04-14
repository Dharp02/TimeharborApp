/**
 * Centralised selectors / locator helpers.
 * Keep UI coupling in one place so tests stay resilient to markup changes.
 */

export const AUTH = {
  fullName: 'Full Name',
  email: 'Email',
  password: '#password',
  confirmPassword: '#confirmPassword',
  createAccount: 'Create Account',
  signIn: 'Sign In',
  signOut: 'Sign Out',
} as const;

export const NAV = {
  brand: 'TimeHarbor',
  timeTracker: 'Time Tracker',
  tickets: 'Tickets',
  settings: 'Settings',
  notepad: 'Notepad',
  projects: 'Projects',
  notifications: 'Notifications',
  activity: 'Activity',
  calendar: 'Calendar',
} as const;
