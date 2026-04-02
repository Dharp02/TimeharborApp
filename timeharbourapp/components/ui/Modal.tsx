'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  Modal as MiewModal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
} from '@mieweb/ui';

/**
 * Override the @mieweb/ui default of full-screen modals on mobile.
 * The library applies min-h-dvh / rounded-none / max-h-dvh under the sm
 * breakpoint; these classes force true dialog behaviour at all sizes.
 */
const MODAL_MOBILE_FIX = [
  '!min-h-0',           // don't stretch to full viewport height
  '!rounded-xl',        // keep rounded corners on mobile
  '!max-h-[90dvh]',     // leave breathing room top & bottom
  'mx-4',               // inset from screen edges
].join(' ');

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
}

export function Modal({ isOpen, onClose, title, children, size }: ModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <MiewModal open={isOpen} onOpenChange={(open) => !open && onClose()} size={size} className={MODAL_MOBILE_FIX}>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
    </MiewModal>,
    document.body,
  );
}
