'use client';

import { Suspense } from 'react';
import EditTicketClient from './EditTicketClient';

export default function EditTicketPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <EditTicketClient />
    </Suspense>
  );
}
