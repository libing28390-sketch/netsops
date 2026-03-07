import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Device {
  id: string;
  hostname: string;
  ip_address: string;
  status: string;
  role: string;
}

interface Link {
  id?: string;
  source_device_id: string;
  target_device_id: string;
}

interface TopologyGraphProps {
  devices: Device[];
  links: Link[];
  onNodeClick?: (device: Device) => void;
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ devices, links, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || devices.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Create a group for zooming/panning
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Prepare nodes and links for D3
    const nodes = devices.map(d => ({ ...d, x: width / 2 + (Math.random() - 0.5) * 100, y: height / 2 + (Math.random() - 0.5) * 100 }));
    
    // If no links are provided, create a star topology around the core device
    let d3Links: any[] = [];
    if (links.length > 0) {
      d3Links = links.map(l => ({
        source: nodes.find(n => n.id === l.source_device_id),
        target: nodes.find(n => n.id === l.target_device_id)
      })).filter(l => l.source && l.target);
    } else {
      const core = nodes.find(n => n.role?.toLowerCase() === 'core');
      if (core) {
        d3Links = nodes.filter(n => n.id !== core.id).map(n => ({
          source: core,
          target: n
        }));
      }
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(60));

    // Draw links
    const link = g.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(d3Links)
      .join("line")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", links.length === 0 ? "4,4" : "none");

    // Draw nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      )
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d as Device);
      });

    // Node circles
    node.append("circle")
      .attr("r", 24)
      .attr("fill", (d: any) => d.status === 'online' ? '#10b981' : '#ef4444')
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer");

    // Node icons (text fallback for simplicity, or we can use SVG icons)
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".3em")
      .attr("fill", "white")
      .attr("font-family", "sans-serif")
      .attr("font-size", "12px")
      .style("pointer-events", "none")
      .text((d: any) => d.role?.substring(0, 1).toUpperCase() || 'D');

    // Node labels
    node.append("text")
      .attr("dy", 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#374151")
      .attr("font-family", "sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .text((d: any) => d.hostname);
      
    node.append("text")
      .attr("dy", 55)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-family", "sans-serif")
      .attr("font-size", "10px")
      .text((d: any) => d.ip_address);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [devices, links, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TopologyGraph;
