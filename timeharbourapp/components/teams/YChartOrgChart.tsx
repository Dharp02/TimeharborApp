'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

interface Member {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface YChartOrgChartProps {
  members: Member[];
  teamName: string;
}

declare global {
  interface Window {
    YChartEditor: any;
  }
}

export function YChartOrgChart({ members, teamName }: YChartOrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [scriptsReady, setScriptsReady] = useState(false);

  const convertMembersToYaml = (members: Member[], teamName: string): string => {
    // Find team leader
    const leader = members.find(m => m.role === 'Leader') || members[0];
    const otherMembers = members.filter(m => m.id !== leader?.id);

    const yaml = `---
options:
  compact: false
  fit: true
  nodeWidth: 250
  nodeHeight: 140
  childrenMargin: 60
  compactMarginBetween: 40
  enablePOI: true
  enableSwapMode: true
  enableSearch: true
schema:
  id: string | required
  name: string | required
  title: string | optional
  email: string | required
---
- id: "${leader?.id || '1'}"
  name: "${leader?.name || 'Team Leader'}"
  title: "Team Leader"
  email: "${leader?.email || 'leader@example.com'}"
  ${otherMembers.length > 0 ? 'children:' : ''}
${otherMembers.map(member => `    - id: "${member.id}"
      name: "${member.name}"
      title: "${member.role || 'Team Member'}"
      email: "${member.email}"`).join('\n')}
`;
    return yaml;
  };

  const initializeYChart = () => {
    if (!containerRef.current || !window.YChartEditor || editorRef.current) {
      return;
    }

    const yamlData = convertMembersToYaml(members, teamName);

    try {
      const editor = new window.YChartEditor({
        nodeWidth: 250,
        nodeHeight: 140,
        childrenMargin: 60,
        compactMarginBetween: 40,
        editorTheme: 'dark',
        collapsible: true
      });
      
      editor.initView(containerRef.current, yamlData);
      console.log('YChart initialized successfully');
      
      editorRef.current = editor;
    } catch (error) {
      console.error('Failed to initialize YChart:', error);
    }
  };

  useEffect(() => {
    if (scriptsReady && containerRef.current) {
      const timeout = setTimeout(() => {
        initializeYChart();
      }, 100);
      
      return () => {
        clearTimeout(timeout);
        if (editorRef.current) {
          editorRef.current = null;
        }
      };
    }
  }, [scriptsReady, members, teamName]);

  const handleScriptsLoad = () => {
    setScriptsReady(true);
  };

  return (
    <>
      <Script
        src="/ychart-editor.js"
        strategy="afterInteractive"
        onLoad={handleScriptsLoad}
      />
      
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          minHeight: '700px', 
          height: '100%',
          width: '100%',
          background: '#f5f7fa'
        }}
      />
    </>
  );
}
