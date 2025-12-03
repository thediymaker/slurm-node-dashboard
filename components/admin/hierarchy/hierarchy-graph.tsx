"use client"

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Organization } from "@/actions/hierarchy";
import { useTheme } from "next-themes";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading Graph...</div>
});

interface HierarchyGraphProps {
  data: Organization[];
  onNodeClick: (node: Organization) => void;
}

export function HierarchyGraph({ data, onNodeClick }: HierarchyGraphProps) {
  const { theme } = useTheme();
  const graphRef = useRef<any>();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
    
    const handleResize = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight
            });
        }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Transform flat list to graph data
    const nodes = data.map(org => {
      let size = 1;
      switch (org.type) {
        case 'root': size = 12; break;
        case 'college': size = 8; break;
        case 'department': size = 5; break;
        case 'group': size = 3; break;
        default: size = 3;
      }
      
      return {
        ...org,
        val: size, 
      };
    });

    const links = data
      .filter(org => org.parent_id)
      .map(org => ({
        source: org.parent_id,
        target: org.id
      }));

    setGraphData({ nodes: nodes as any, links: links as any });
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] border rounded-lg overflow-hidden bg-card">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={(node: any) => {
            switch(node.type) {
                case 'root': return '#ef4444';
                case 'college': return '#f97316';
                case 'department': return '#eab308';
                case 'group': return '#22c55e';
                default: return '#3b82f6';
            }
        }}
        onNodeClick={(node) => onNodeClick(node as any)}
        linkColor={() => theme === 'dark' ? '#555' : '#ccc'}
        backgroundColor={theme === 'dark' ? '#020817' : '#ffffff'}
      />
    </div>
  );
}
