"use client";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
const backendUrl = process.env.NEXT_PUBLIC_API_URL;
//import ForceGraph3D from "react-force-graph-3d";

import dynamic from 'next/dynamic'
const ForceGraph3D = dynamic(
  () => import('react-force-graph-3d'),
  { ssr: false }
)

// const ForceGraph3D = dynamic(() => import("react-force-graph").then(mod => mod.ForceGraph3D), {
//   ssr: false,
// });

type NodeType = {
  id: string | number;
  label?: string;
  char?: string[];
  tags?: string[];
  group?: string;
};

type LinkType = {
  source: string | number | NodeType;
  target: string | number | NodeType;
};

type GraphDataType = {
  nodes: NodeType[];
  links: LinkType[];
};

const RelationshipGraph = () => {
  const [graphData, setGraphData] = useState<GraphDataType>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hoverNode, setHoverNode] = useState<NodeType | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetchGraph();
  }, []);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${backendUrl}/api/relationships/graph`);
      setGraphData(res.data);
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: get all connected nodes within N hops (e.g., 2)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getMultiHopNeighbors = (node: any, hops = 2) => {
    if (!node) return new Set();

    const neighbors = new Set([node.id]);
    let currentLevel = new Set([node.id]);

    for (let i = 0; i < hops; i++) {
      const nextLevel = new Set();
      graphData.links.forEach(({ source, target }) => {
        const srcId = typeof source === "object" ? source.id : source;
        const tgtId = typeof target === "object" ? target.id : target;

        currentLevel.forEach(id => {
          if (srcId === id && !neighbors.has(tgtId)) {
            neighbors.add(tgtId);
            nextLevel.add(tgtId);
          }
          if (tgtId === id && !neighbors.has(srcId)) {
            neighbors.add(srcId);
            nextLevel.add(srcId);
          }
        });
      });
      currentLevel = nextLevel;
      if (currentLevel.size === 0) break;
    }

    return neighbors;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Relationship Graph</h2>
      {loading ? (
        <p className="text-gray-400">Loading graph...</p>
      ) : (
        <ForceGraph3D
          ref={fgRef}
          width={1200}
          graphData={graphData}
          onNodeHover={node => {
            if (node && typeof node.id !== "undefined") {
              // Cast node to NodeType, ensuring id is defined
              setHoverNode({
                id: node.id,
                label: node.label,
                char: node.char,
                tags: node.tags,
                group: node.group
              });
            } else {
              setHoverNode(null);
            }
          }}
          nodeLabel={node => {
            const associatedTags = node.char || node.tags || "None";
            return `
              ID: ${node.id}
              Label: ${node.label || "No label"}
              Associated Tags: ${Array.isArray(associatedTags) ? associatedTags.join(", ") : associatedTags}
              Group: ${node.group || "None"}
            `;
          }}
          nodeColor={node => {
            if (!hoverNode) return "#00aaff";

            const multiHopNeighbors = getMultiHopNeighbors(hoverNode, 2);

            if (node.id === hoverNode.id) return "orange"; // hovered node
            if (multiHopNeighbors.has(node.id)) return "#ffaa00"; // neighbors within 2 hops
            return "#00aaff";
          }}
          linkColor={link => {
            if (!hoverNode) return "#999";

            const multiHopNeighbors = getMultiHopNeighbors(hoverNode, 2);
            const srcId = typeof link.source === "object" ? link.source.id : link.source;
            const tgtId = typeof link.target === "object" ? link.target.id : link.target;

            if (multiHopNeighbors.has(srcId) && multiHopNeighbors.has(tgtId)) {
              return "#ffaa00"; // highlight links within multi-hop cluster
            }
            return "#999";
          }}
          nodeRelSize={8}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          backgroundColor="#111"
        />
      )}
    </div>
  );
};

export default RelationshipGraph;
