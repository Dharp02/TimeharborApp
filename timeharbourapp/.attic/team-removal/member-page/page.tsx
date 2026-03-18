import MemberPageClient from './MemberPageClient';

// Ensure this page is treated as static
export const dynamic = 'force-static';

export default function MemberPage() {
  return <MemberPageClient />;
}
