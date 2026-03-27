import EditTicketClient from './EditTicketClient';

// Required for static export (Capacitor builds). Returns [] because ticket IDs
// are dynamic — pages are reached via client-side navigation only.
export async function generateStaticParams() {
  return [];
}

// Setting revalidate = 0 bypasses Next.js 16's check that requires
// generateStaticParams to return a non-empty array for output: export.
export const revalidate = 0;

export default function EditTicketPage() {
  return <EditTicketClient />;
}
