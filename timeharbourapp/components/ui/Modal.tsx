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
    <MiewModal open={isOpen} onOpenChange={(open) => !open && onClose()} size={size}>
      <ModalHeader className="pt-16 lg:pt-4">
        <ModalTitle>{title}</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
    </MiewModal>,
    document.body,
  );
}
