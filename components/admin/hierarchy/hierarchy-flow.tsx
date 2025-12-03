"use client"

import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Position,
  Controls,
  Background,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Organization } from '@/actions/hierarchy';
import { useTheme } from 'next-themes';

interface HierarchyFlowProps {
  data: Organization[];
  onNodeClick: (node: Organization) => void;
}

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

function HierarchyFlowContent({ data, onNodeClick }: HierarchyFlowProps) {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const initialNodes: Node[] = data.map((org) => ({
      id: org.id.toString(),
      data: { label: org.name, original: org },
      position: { x: 0, y: 0 },
      style: {
        background: theme === 'dark' ? '#1e293b' : '#ffffff',
        color: theme === 'dark' ? '#f8fafc' : '#0f172a',
        border: '1px solid #94a3b8',
        borderRadius: '8px',
        padding: '8px',
        fontSize: '12px',
        width: nodeWidth,
      },
    }));

    const initialEdges: Edge[] = data
      .filter((org) => org.parent_id)
      .map((org) => ({
        id: `e${org.parent_id}-${org.id}`,
        source: org.parent_id!.toString(),
        target: org.id.toString(),
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#94a3b8' },
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Fit view after a short delay to allow rendering
    setTimeout(() => {
        fitView();
    }, 100);

  }, [data, theme, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: 'smoothstep', animated: true }, eds)
      ),
    [setEdges]
  );

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    onNodeClick(node.data.original as Organization);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      fitView
      attributionPosition="bottom-right"
    >
      <Controls />
      <Background color="#aaa" gap={16} />
    </ReactFlow>
  );
}

export function HierarchyFlow(props: HierarchyFlowProps) {
    return (
        <ReactFlowProvider>
            <div className="w-full h-full min-h-[500px] border rounded-lg overflow-hidden bg-card">
                <HierarchyFlowContent {...props} />
            </div>
        </ReactFlowProvider>
    );
}
