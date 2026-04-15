/**
 * Centralised selectors / locator helpers.
 * Keep UI coupling in one place so tests stay resilient to markup changes.
 */

export const AUTH = {
  email: 'Email',
  password: '#password',
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

export const WALKTHROUGH = {
  overlay: '.wt-overlay',
  tooltip: '.wt-tooltip',
  title: '.wt-title',
  counter: '.wt-counter',
  nextBtn: '.wt-actions button:last-child',
  backBtn: '.wt-actions button:first-child',
  skipBtn: '.wt-skip-btn',
  dot: '.wt-dot',
  activeDot: '.wt-dot--active',
  progressBar: '.wt-progress-bar',
} as const;
