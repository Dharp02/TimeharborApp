'use client';

import React from 'react';
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
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <MiewModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
    </MiewModal>
  );
}
