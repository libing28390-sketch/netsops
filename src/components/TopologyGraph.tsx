import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Device {
  id: string;
  hostname: string;
  ip_address: string;
  status: string;
  role: string;
  site?: string;
  health_status?: string;
  open_alert_count?: number;
  critical_open_alerts?: number;
}

interface Link {
  id?: string;
  link_key?: string;
  source_device_id: string;
  target_device_id: string;
  source_port?: string;
  target_port?: string;
  inferred?: boolean;
  source_hostname?: string;
  target_hostname?: string;
  operational_state?: 'up' | 'degraded' | 'down' | 'unknown';
  evidence_count?: number;
}

interface TopologyGraphProps {
  devices: Device[];
  links: Link[];
  onNodeClick?: (device: Device) => void;
  selectedNodeId?: string | null;
  selectedLinkKey?: string | null;
  onLinkClick?: (link: Link) => void;
}

const abbreviateInterface = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/^GigabitEthernet/i, 'Gi')
    .replace(/^TenGigabitEthernet/i, 'Te')
    .replace(/^TwentyFiveGigE/i, 'Tw')
    .replace(/^FortyGigabitEthernet/i, 'Fo')
    .replace(/^HundredGigabitEthernet/i, 'Hu')
    .replace(/^Ethernet/i, 'Eth')
    .replace(/^Port-channel/i, 'Po')
    .replace(/^Loopback/i, 'Lo');
};

const getRoleBucket = (role?: string) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole.includes('core')) return 'core';
  if (normalizedRole.includes('distribution') || normalizedRole.includes('edge')) return 'distribution';
  if (normalizedRole.includes('access')) return 'access';
  return 'other';
};

const getRoleInitial = (role?: string) => {
  const normalizedRole = String(role || '').trim();
  return normalizedRole ? normalizedRole.charAt(0).toUpperCase() : 'D';
};

const getNodeTone = (device: Device) => {
  if (device.status === 'offline') {
    return { fill: '#ef4444', stroke: '#b91c1c', halo: 'rgba(239,68,68,0.18)' };
  }
  if (device.health_status === 'critical' || (device.critical_open_alerts || 0) > 0) {
    return { fill: '#f97316', stroke: '#c2410c', halo: 'rgba(249,115,22,0.18)' };
  }
  if (device.health_status === 'warning' || (device.open_alert_count || 0) > 0 || device.status === 'pending') {
    return { fill: '#f59e0b', stroke: '#b45309', halo: 'rgba(245,158,11,0.18)' };
  }
  return { fill: '#10b981', stroke: '#047857', halo: 'rgba(16,185,129,0.16)' };
};

const getLinkTone = (link: Link) => {
  switch (link.operational_state) {
    case 'up':
      return { stroke: '#10b981', muted: 'rgba(16,185,129,0.24)', labelFill: 'rgba(236,253,245,0.96)', labelStroke: 'rgba(16,185,129,0.32)' };
    case 'degraded':
      return { stroke: '#f59e0b', muted: 'rgba(245,158,11,0.24)', labelFill: 'rgba(255,251,235,0.96)', labelStroke: 'rgba(245,158,11,0.34)' };
    case 'down':
      return { stroke: '#ef4444', muted: 'rgba(239,68,68,0.24)', labelFill: 'rgba(254,242,242,0.96)', labelStroke: 'rgba(239,68,68,0.34)' };
    default:
      return { stroke: '#64748b', muted: 'rgba(100,116,139,0.22)', labelFill: 'rgba(255,255,255,0.94)', labelStroke: 'rgba(148,163,184,0.35)' };
  }
};

const buildSeedPositions = (devices: Device[], width: number, height: number) => {
  const buckets: Record<string, Device[]> = {
    core: [],
    distribution: [],
    access: [],
    other: [],
  };

  devices.forEach((device) => {
    buckets[getRoleBucket(device.role)].push(device);
  });

  const rowOrder: Array<keyof typeof buckets> = ['core', 'distribution', 'access', 'other'];
  const rowY: Record<(typeof rowOrder)[number], number> = {
    core: height * 0.2,
    distribution: height * 0.42,
    access: height * 0.68,
    other: height * 0.84,
  };
  const positions: Record<string, { x: number; y: number }> = {};

  rowOrder.forEach((bucketName) => {
    const bucket = buckets[bucketName];
    bucket.forEach((device, index) => {
      const x = ((index + 1) * width) / (bucket.length + 1);
      const jitter = bucketName === 'other' ? ((index % 2 === 0 ? 1 : -1) * 24) : ((index % 2 === 0 ? 1 : -1) * 12);
      positions[device.id] = {
        x,
        y: rowY[bucketName] + jitter,
      };
    });
  });

  return positions;
};

const TopologyGraph: React.FC<TopologyGraphProps> = ({ devices, links, onNodeClick, selectedNodeId, selectedLinkKey, onLinkClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateViewport = () => {
      if (!containerRef.current) return;
      setViewport({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || devices.length === 0 || viewport.width === 0 || viewport.height === 0) return;

    const width = viewport.width;
    const height = viewport.height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom as any);
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(width * 0.04, height * 0.04).scale(0.92));

    const seededPositions = buildSeedPositions(devices, width, height);
    const nodes = devices.map((device) => ({
      ...device,
      x: seededPositions[device.id]?.x ?? width / 2,
      y: seededPositions[device.id]?.y ?? height / 2,
    }));
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const rawLinks = links
      .map((link) => ({
        ...link,
        source: nodeMap.get(link.source_device_id),
        target: nodeMap.get(link.target_device_id),
      }))
      .filter((link) => link.source && link.target);

    const seen = new Set<string>();
    let d3Links = rawLinks.filter((link) => {
      const left = String(link.source_device_id || '');
      const right = String(link.target_device_id || '');
      const pair = [left, right].sort().join('::');
      const portKey = [String(link.source_port || ''), String(link.target_port || '')].sort().join('::');
      const key = `${pair}::${portKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (d3Links.length === 0 && nodes.length > 1) {
      const hubDevices = nodes.filter((node) => getRoleBucket(node.role) === 'core');
      const siteHubs = new Map<string, any>();
      nodes.forEach((node) => {
        const siteKey = String(node.site || '').trim().toLowerCase();
        if (!siteKey || siteHubs.has(siteKey)) return;
        siteHubs.set(siteKey, node);
      });
      const fallbackHub = hubDevices[0] || nodes[0];

      d3Links = nodes
        .filter((node) => node.id !== fallbackHub.id)
        .map((node) => {
          const siteKey = String(node.site || '').trim().toLowerCase();
          const siteHub = siteKey ? siteHubs.get(siteKey) : null;
          const source = siteHub && siteHub.id !== node.id ? siteHub : fallbackHub;
          return {
            source,
            target: node,
            source_device_id: source.id,
            target_device_id: node.id,
            inferred: true,
          };
        })
        .filter((link) => link.source && link.target && link.source.id !== link.target.id);
    }

    const neighborMap = new Map<string, Set<string>>();
    d3Links.forEach((link: any) => {
      const sourceId = link.source.id;
      const targetId = link.target.id;
      if (!neighborMap.has(sourceId)) neighborMap.set(sourceId, new Set());
      if (!neighborMap.has(targetId)) neighborMap.set(targetId, new Set());
      neighborMap.get(sourceId)?.add(targetId);
      neighborMap.get(targetId)?.add(sourceId);
    });

    const selectedNeighbors = selectedNodeId ? (neighborMap.get(selectedNodeId) || new Set<string>()) : new Set<string>();
    const hasFocus = Boolean(selectedNodeId);

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(d3Links as any).id((d: any) => d.id).distance((link: any) => (link.inferred ? 140 : 110)).strength((link: any) => (link.inferred ? 0.25 : 0.9)))
      .force('charge', d3.forceManyBody().strength(-680))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(48))
      .force('x', d3.forceX((node: any) => seededPositions[node.id]?.x ?? width / 2).strength(0.18))
      .force('y', d3.forceY((node: any) => seededPositions[node.id]?.y ?? height / 2).strength(0.24));

    const linkLayer = g.append('g').attr('stroke-linecap', 'round');

    const linkHitArea = linkLayer
      .selectAll('line.link-hit')
      .data(d3Links)
      .join('line')
      .attr('class', 'link-hit')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 18)
      .style('cursor', (item: any) => (item.inferred ? 'default' : 'pointer'))
      .on('click', (_event, item: any) => {
        if (!onLinkClick || item.inferred) return;
        onLinkClick(item as Link);
      });

    const link = linkLayer
      .selectAll('line.link-visible')
      .data(d3Links)
      .join('line')
      .attr('class', 'link-visible')
      .attr('stroke', (item: any) => {
        const tone = getLinkTone(item as Link);
        const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
        const isFocused = selectedNodeId && (item.source.id === selectedNodeId || item.target.id === selectedNodeId);
        if (isSelected) return '#0284c7';
        if (isFocused) return tone.stroke;
        return item.inferred ? tone.muted : tone.stroke;
      })
      .attr('stroke-width', (item: any) => {
        const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
        const isFocused = selectedNodeId && (item.source.id === selectedNodeId || item.target.id === selectedNodeId);
        if (isSelected) return 4;
        if (item.operational_state === 'down') return isFocused ? 3.6 : 2.8;
        return isFocused ? 3 : item.inferred ? 1.5 : 2.2;
      })
      .attr('stroke-dasharray', (item: any) => (item.inferred ? '6,5' : 'none'))
      .attr('opacity', (item: any) => {
        const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
        if (isSelected) return 1;
        if (!hasFocus) return 1;
        return item.source.id === selectedNodeId || item.target.id === selectedNodeId ? 1 : 0.18;
      });

    const labelledLinks = d3Links.filter((item: any) => item.source_port || item.target_port);
    const linkLabelGroup = g.append('g')
      .selectAll('g')
      .data(labelledLinks)
      .join('g');

    const linkLabelText = linkLabelGroup
      .append('text')
      .attr('font-size', 10)
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('fill', '#0f172a')
      .attr('font-weight', 700)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text((item: any) => {
        const left = abbreviateInterface(item.source_port);
        const right = abbreviateInterface(item.target_port);
        if (left && right) return `${left} <> ${right}`;
        return left || right;
      });

    const linkLabelBg = linkLabelGroup
      .insert('rect', 'text')
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (item: any) => {
        const tone = getLinkTone(item as Link);
        const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
        return isSelected ? 'rgba(224,242,254,0.96)' : tone.labelFill;
      })
      .attr('stroke', (item: any) => {
        const tone = getLinkTone(item as Link);
        const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
        return isSelected ? 'rgba(2,132,199,0.55)' : tone.labelStroke;
      })
      .attr('stroke-width', 1);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d as Device);
      });

    node.append('circle')
      .attr('r', 31)
      .attr('fill', (d: any) => {
        const tone = getNodeTone(d);
        return selectedNodeId === d.id ? tone.halo : 'rgba(148,163,184,0.08)';
      })
      .attr('stroke', (d: any) => (selectedNodeId === d.id ? '#0f172a' : 'rgba(148,163,184,0.18)'))
      .attr('stroke-width', (d: any) => (selectedNodeId === d.id ? 2.5 : 1))
      .attr('opacity', (d: any) => {
        if (!hasFocus) return 1;
        return d.id === selectedNodeId || selectedNeighbors.has(d.id) ? 1 : 0.25;
      });

    node.append("circle")
      .attr("r", 24)
      .attr('fill', (d: any) => getNodeTone(d).fill)
      .attr('stroke', (d: any) => getNodeTone(d).stroke)
      .attr('stroke-width', (d: any) => (selectedNodeId === d.id ? 3 : 2))
      .style('cursor', 'pointer')
      .attr('opacity', (d: any) => {
        if (!hasFocus) return 1;
        return d.id === selectedNodeId || selectedNeighbors.has(d.id) ? 1 : 0.35;
      });

    node.append('circle')
      .attr('r', (d: any) => ((d.open_alert_count || 0) > 0 ? 6.5 : 0))
      .attr('cx', 18)
      .attr('cy', -18)
      .attr('fill', (d: any) => ((d.critical_open_alerts || 0) > 0 ? '#dc2626' : '#f59e0b'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('opacity', (d: any) => ((d.open_alert_count || 0) > 0 ? 1 : 0));

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.34em')
      .attr('fill', 'white')
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('font-weight', 700)
      .style('pointer-events', 'none')
      .text((d: any) => getRoleInitial(d.role));

    node.append('text')
      .attr('dy', 42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0f172a')
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('opacity', (d: any) => {
        if (!hasFocus) return 1;
        return d.id === selectedNodeId || selectedNeighbors.has(d.id) ? 1 : 0.35;
      })
      .text((d: any) => d.hostname);

    node.append('text')
      .attr('dy', 57)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('font-size', '10px')
      .attr('opacity', (d: any) => {
        if (!hasFocus) return 0.95;
        return d.id === selectedNodeId || selectedNeighbors.has(d.id) ? 0.95 : 0.28;
      })
      .text((d: any) => d.site || d.ip_address);

    simulation.on('tick', () => {
      nodes.forEach((node: any) => {
        node.x = Math.max(48, Math.min(width - 48, node.x || width / 2));
        node.y = Math.max(56, Math.min(height - 56, node.y || height / 2));
      });

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkHitArea
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabelGroup
        .attr('transform', (d: any) => `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2 - 6})`)
        .attr('opacity', (item: any) => {
          const isSelected = Boolean(selectedLinkKey && (item.link_key === selectedLinkKey || item.id === selectedLinkKey));
          if (isSelected) return 1;
          if (!hasFocus) return 0.96;
          return item.source.id === selectedNodeId || item.target.id === selectedNodeId ? 0.98 : 0.15;
        });

      linkLabelBg.each(function () {
        const textNode = d3.select(this.nextSibling as SVGTextElement).node();
        if (!textNode) return;
        const bbox = textNode.getBBox();
        d3.select(this)
          .attr('x', bbox.x - 6)
          .attr('y', bbox.y - 4)
          .attr('width', bbox.width + 12)
          .attr('height', bbox.height + 8);
      });

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
  }, [devices, links, onLinkClick, onNodeClick, selectedLinkKey, selectedNodeId, viewport.height, viewport.width]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
          No topology data available.
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TopologyGraph;
