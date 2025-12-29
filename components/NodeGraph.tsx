import React, { useState, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, Sliders, Palette, Grid3X3, MonitorPlay } from 'lucide-react';
import { DitherSettings } from '../types';

interface NodeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DitherSettings;
}

interface NodePosition {
  x: number;
  y: number;
}

export const NodeGraph: React.FC<NodeGraphProps> = ({ isOpen, onClose, settings }) => {
  // Dimensions
  const NODE_WIDTH = 192; // w-48
  const NODE_HEIGHT = 160; // h-40

  // State for node positions
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({
    input: { x: 50, y: 150 },
    preprocess: { x: 300, y: 150 },
    palette: { x: 550, y: 150 },
    dither: { x: 800, y: 150 },
    output: { x: 1050, y: 150 }
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const pos = nodePositions[id];
    setDraggingId(id);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId && containerRef.current) {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      setNodePositions(prev => ({
        ...prev,
        [draggingId]: { x: newX, y: newY }
      }));
    }
  }, [draggingId]);

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  if (!isOpen) return null;

  // Node Content Definition
  const nodes = [
    {
      id: 'input',
      label: 'Input Source',
      icon: ImageIcon,
      color: 'bg-zinc-500',
      details: ['Original Image', 'RGB Data']
    },
    {
      id: 'preprocess',
      label: 'Pre-Process',
      icon: Sliders,
      color: 'bg-blue-500',
      details: [
        `Contrast: ${settings.contrast.toFixed(1)}`,
        `Brightness: ${settings.brightness.toFixed(2)}`,
        settings.saturation !== 1 ? `Sat: ${settings.saturation.toFixed(1)}` : null,
        settings.sharpen > 0 ? `Sharpen: ${settings.sharpen}` : null,
        settings.blur > 0 ? `Blur: ${settings.blur}` : null,
        settings.invert ? 'Invert: On' : null,
        settings.greyscale ? 'Greyscale: On' : null
      ].filter(Boolean) as string[]
    },
    {
      id: 'palette',
      label: 'Color Engine',
      icon: Palette,
      color: 'bg-pink-500',
      details: [
        settings.useQuantization ? `Dynamic: ${settings.quantizationAlgo}` : `Preset: ${settings.paletteId}`,
        settings.useQuantization ? `Max Colors: ${settings.maxColors}` : 'Fixed Palette',
        `Metric: ${settings.colorMetric}`
      ]
    },
    {
      id: 'dither',
      label: 'Dither Logic',
      icon: Grid3X3,
      color: 'bg-accent-600',
      details: [
        settings.method,
        `Pixel Size: ${settings.pixelSize}x`,
        `Strength: ${(settings.ditherStrength * 100).toFixed(0)}%`,
        settings.serpentine ? 'Serpentine: On' : null
      ].filter(Boolean) as string[]
    },
    {
      id: 'output',
      label: 'Render',
      icon: MonitorPlay,
      color: 'bg-emerald-500',
      details: ['Final PNG', 'Browser View']
    }
  ];

  const renderConnections = () => {
    return nodes.map((node, index) => {
      if (index === nodes.length - 1) return null;
      const nextNode = nodes[index + 1];
      
      const currentPos = nodePositions[node.id];
      const nextPos = nodePositions[nextNode.id];

      // Exact center points for connections (ports are vertically centered at 50% of height)
      const startX = currentPos.x + NODE_WIDTH;
      const startY = currentPos.y + (NODE_HEIGHT / 2);
      const endX = nextPos.x;
      const endY = nextPos.y + (NODE_HEIGHT / 2);

      const dist = Math.abs(endX - startX);
      const cpOffset = Math.max(dist * 0.5, 50); // Minimum curve

      const cp1X = startX + cpOffset;
      const cp1Y = startY;
      const cp2X = endX - cpOffset;
      const cp2Y = endY;

      const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

      return (
        <g key={`conn-${index}`}>
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-500/20 dark:text-zinc-500/30"
          />
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="10 10"
            className="text-accent-500 animate-[dash_1s_linear_infinite]"
          />
          <circle cx={endX} cy={endY} r="4" className="fill-accent-500" />
          <circle cx={startX} cy={startY} r="3" className="fill-zinc-500" />
        </g>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-200">
       
       {/* Background Grid */}
       <div className="absolute inset-0 opacity-10 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #808080 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }} 
       />

       {/* Toolbar / Header */}
       <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-50">
          <h2 className="text-3xl font-bold text-zinc-900/20 dark:text-white/20 uppercase tracking-widest select-none">
            Processing Pipeline
          </h2>
          <button 
            onClick={onClose}
            className="pointer-events-auto p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-zinc-900 dark:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
       </div>

      <div 
        ref={containerRef}
        className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
            {/* SVG Layer for wires */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
                <style>
                    {`@keyframes dash { to { stroke-dashoffset: -20; } }`}
                </style>
                {renderConnections()}
            </svg>

            {/* Nodes Layer */}
            {nodes.map((node) => {
                const pos = nodePositions[node.id];
                return (
                  <div
                      key={node.id}
                      className="absolute group z-10"
                      style={{ 
                          width: NODE_WIDTH,
                          height: NODE_HEIGHT,
                          transform: `translate(${pos.x}px, ${pos.y}px)`,
                          cursor: draggingId === node.id ? 'grabbing' : 'grab'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, node.id)}
                  >
                      {/* Node Card */}
                      <div className="relative w-full h-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 shadow-xl hover:border-accent-500/50 hover:shadow-accent-500/20 transition-colors duration-200 flex flex-col select-none">
                          
                          {/* Header */}
                          <div className="flex-none flex items-center gap-3 mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                              <div className={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center text-white shadow-md`}>
                                  <node.icon className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{node.label}</span>
                          </div>

                          {/* Details */}
                          <div className="flex-1 space-y-1.5 overflow-hidden">
                              {node.details.map((detail, idx) => (
                                  <div key={idx} className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                      <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
                                      <span className="truncate">{detail}</span>
                                  </div>
                              ))}
                          </div>

                          {/* Ports - Vertically Centered with Translate */}
                          {node.id !== 'input' && (
                            <div className="absolute top-1/2 -left-1.5 w-3 h-3 bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-600 rounded-full -translate-y-1/2" />
                          )}
                          {node.id !== 'output' && (
                            <div className="absolute top-1/2 -right-1.5 w-3 h-3 bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-600 rounded-full -translate-y-1/2" />
                          )}
                      </div>
                  </div>
                );
            })}
      </div>
    </div>
  );
};