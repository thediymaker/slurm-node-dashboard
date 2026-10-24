"use client"

import React, { useCallback, useEffect, useMemo } from 'react';
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
  useNodesInitialized,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Organization } from '@/actions/hierarchy';

interface HierarchyFlowProps {
  data: Organization[];
  onNodeClick: (node: Organization) => void;
}

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  // Left to right: a wide tree of departments would otherwise shrink to nothing
  dagreGraph.setGraph({ rankdir: direction, nodesep: 14, ranksep: 70 });

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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // The app's colors, so nodes follow light and dark mode
  const nodeStyle = useMemo(() => ({
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '12px',
    width: nodeWidth,
  }), []);

  useEffect(() => {
    if (!data.length) return;

    const initialNodes: Node[] = data.map((org) => ({
      id: org.id.toString(),
      data: { label: org.name, original: org },
      position: { x: 0, y: 0 },
      style: nodeStyle,
    }));

    const initialEdges: Edge[] = data
      .filter((org) => org.parent_id)
      .map((org) => ({
        id: `e${org.parent_id}-${org.id}`,
        source: org.parent_id!.toString(),
        target: org.id.toString(),
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--muted-foreground))' },
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, nodeStyle, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: 'smoothstep', animated: true }, eds)
      ),
    [setEdges]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeClick(node.data.original as Organization);
  }, [onNodeClick]);

  // Fit once React Flow has measured the nodes; before that it fits to nothing
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (nodesInitialized) fitView({ padding: 0.15 });
  }, [nodesInitialized, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      fitView
      minZoom={0.1}
      attributionPosition="bottom-right"
      proOptions={{ hideAttribution: true }}
    >
      <Controls showInteractive={false} />
      <Background color="hsl(var(--muted-foreground) / 0.25)" gap={16} />
    </ReactFlow>
  );
}

// React Flow's controls in the app's colors, so they follow light and dark mode
const FLOW_COLORS = {
  '--xy-controls-button-background-color': 'hsl(var(--card))',
  '--xy-controls-button-background-color-hover': 'hsl(var(--muted))',
  '--xy-controls-button-color': 'hsl(var(--foreground))',
  '--xy-controls-button-color-hover': 'hsl(var(--foreground))',
  '--xy-controls-button-border-color': 'hsl(var(--border))',
  '--xy-controls-box-shadow': 'none',
} as React.CSSProperties;

export function HierarchyFlow(props: HierarchyFlowProps) {
    return (
        <ReactFlowProvider>
            <div className="w-full h-full min-h-[500px] border rounded-lg overflow-hidden bg-card" style={FLOW_COLORS}>
                <HierarchyFlowContent {...props} />
            </div>
        </ReactFlowProvider>
    );
}
