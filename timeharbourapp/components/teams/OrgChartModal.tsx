'use client';

import { Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { YChartOrgChart } from './YChartOrgChart';
import { Member } from '@/components/dashboard/TeamContext';

interface OrgChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName?: string;
  members?: Member[];
}

export function OrgChartModal({ isOpen, onClose, teamName, members = [] }: OrgChartModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>Organization Chart</span>
          {teamName && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              - {teamName}
            </span>
          )}
        </div>
      }
      size="full"
    >
      <div className="flex flex-col h-full">
        <YChartOrgChart members={members} teamName={teamName || 'Team'} />
      </div>
    </Modal>
  );
}

