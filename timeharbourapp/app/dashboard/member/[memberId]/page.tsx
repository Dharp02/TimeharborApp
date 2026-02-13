import MemberPageClient from './MemberPageClient';

// Ensure this page is treated as static
export const dynamic = 'force-static';

// Required for static export: generate empty params to skip pre-rendering
// This relies on client-side routing to handle dynamic IDs
export async function generateStaticParams() {
  return [{ memberId: 'index' }];
}

export default function MemberPage() {
  return <MemberPageClient />;
}
