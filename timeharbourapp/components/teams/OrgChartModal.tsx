'use client';

import { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, Maximize2, Users, Edit3, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface OrgChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName?: string;
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  email: string;
  children?: OrgNode[];
}

export function OrgChartModal({ isOpen, onClose, teamName }: OrgChartModalProps) {
  const [zoom, setZoom] = useState(100);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Sample org chart data - replace with actual data later
  const [orgData, setOrgData] = useState<OrgNode>({
    id: '1',
    name: 'John Doe',
    role: 'Team Leader',
    email: 'john@example.com',
    children: [
      {
        id: '2',
        name: 'Jane Smith',
        role: 'Developer',
        email: 'jane@example.com',
        children: [
          {
            id: '4',
            name: 'Mike Johnson',
            role: 'Junior Developer',
            email: 'mike@example.com',
          },
          {
            id: '5',
            name: 'Sarah Wilson',
            role: 'Junior Developer',
            email: 'sarah@example.com',
          }
        ]
      },
      {
        id: '3',
        name: 'Bob Brown',
        role: 'Designer',
        email: 'bob@example.com',
        children: [
          {
            id: '6',
            name: 'Alice Davis',
            role: 'UI Designer',
            email: 'alice@example.com',
          }
        ]
      }
    ]
  });

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export org chart');
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  const renderNode = (node: OrgNode, isRoot = false) => {
    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Node Card */}
        <div 
          className={`
            relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[200px] border-2
            ${isRoot ? 'border-purple-500' : 'border-gray-200 dark:border-gray-700'}
            hover:shadow-xl transition-all duration-200
            ${isEditMode ? 'cursor-pointer hover:border-blue-400' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm flex-shrink-0">
              {node.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {node.name}
              </h4>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {node.role}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                {node.email}
              </p>
            </div>
          </div>
          
          {isEditMode && (
            <button className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors">
              <Edit3 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Connection Line and Children */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col items-center">
            {/* Vertical Line */}
            <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600"></div>
            
            {/* Horizontal Line */}
            {node.children.length > 1 && (
              <div className="relative w-full">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-0.5 bg-gray-300 dark:bg-gray-600"></div>
              </div>
            )}
            
            {/* Children Nodes */}
            <div className="flex gap-8 mt-8">
              {node.children.map((child, index) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical connection to child */}
                  <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 -mt-8"></div>
                  {renderNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleEditMode}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${isEditMode 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {isEditMode ? (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit Mode
                </>
              )}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Full Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div 
            className="p-12 min-w-max min-h-full flex items-start justify-center"
            style={{ 
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
          >
            {renderNode(orgData, true)}
          </div>
        </div>

        {/* Info Footer */}
        {isEditMode && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              <span className="font-medium">Edit Mode Active:</span> Click on any member card to edit their details or reorganize the structure
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
