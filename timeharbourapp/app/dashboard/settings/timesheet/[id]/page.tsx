import TimesheetEntryClient from './TimesheetEntryClient';

// Required for static export (Capacitor builds). Returns [] because timesheet IDs
// are dynamic — pages are reached via client-side navigation only.
export async function generateStaticParams() {
  return [];
}

// Setting revalidate = 0 bypasses Next.js 16's check that requires
// generateStaticParams to return a non-empty array for output: export.
export const revalidate = 0;

export default function TimesheetEntryPage() {
  return <TimesheetEntryClient />;
}
