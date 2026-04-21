import { redirect } from 'next/navigation';

// About page has moved to the external TimeHarbor website.
// Old in-app page archived to .attic/about-page.tsx
export default function AboutPage() {
  redirect('https://timeharborwebsite.os.mieweb.org/');
}
