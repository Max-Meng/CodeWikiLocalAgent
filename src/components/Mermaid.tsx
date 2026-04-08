import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  suppressErrorRendering: true,
  logLevel: 'error',
  maxTextSize: 100000,
  htmlLabels: true,
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    nodeSpacing: 60,
    rankSpacing: 60,
    padding: 20,
  },
  themeCSS: `
    .node rect, .node circle, .node ellipse, .node polygon, .node path {
      fill: #f8f4e6; stroke: #d7c4bb; stroke-width: 1px;
    }
    .edgePath .path { stroke: #9b7cb9; stroke-width: 1.5px; }
    .edgeLabel { background-color: transparent; color: #333333; }
    .edgeLabel p { background-color: transparent !important; }
    .label { color: #333333; }
    .cluster rect { fill: #f8f4e6; stroke: #d7c4bb; stroke-width: 1px; }
    .actor { fill: #f8f4e6; stroke: #d7c4bb; stroke-width: 1px; }
    text.actor { fill: #333333; stroke: none; }
    .messageText { fill: #333333; stroke: none; }
    .messageLine0, .messageLine1 { stroke: #9b7cb9; }
    .noteText { fill: #333333; }
    [data-theme="dark"] .node rect, [data-theme="dark"] .node circle,
    [data-theme="dark"] .node ellipse, [data-theme="dark"] .node polygon,
    [data-theme="dark"] .node path { fill: #222222; stroke: #5d4037; }
    [data-theme="dark"] .edgePath .path { stroke: #9370db; }
    [data-theme="dark"] .edgeLabel { background-color: transparent; color: #f0f0f0; }
    [data-theme="dark"] .label { color: #f0f0f0; }
    [data-theme="dark"] .cluster rect { fill: #222222; stroke: #5d4037; }
    [data-theme="dark"] .flowchart-link { stroke: #9370db; }
    [data-theme="dark"] .actor { fill: #222222; stroke: #5d4037; }
    [data-theme="dark"] text.actor { fill: #f0f0f0; stroke: none; }
    [data-theme="dark"] .messageText { fill: #f0f0f0; stroke: none; font-weight: 500; }
    [data-theme="dark"] .messageLine0, [data-theme="dark"] .messageLine1 { stroke: #9370db; stroke-width: 1.5px; }
    [data-theme="dark"] .noteText { fill: #f0f0f0; }
    text[text-anchor][dominant-baseline], text[text-anchor][alignment-baseline],
    .nodeLabel, .edgeLabel, .label, text { fill: #777 !important; }
    [data-theme="dark"] text[text-anchor][dominant-baseline],
    [data-theme="dark"] text[text-anchor][alignment-baseline],
    [data-theme="dark"] .nodeLabel, [data-theme="dark"] .edgeLabel,
    [data-theme="dark"] .label, [data-theme="dark"] text { fill: #f0f0f0 !important; }
  `,
  fontFamily: 'var(--font-geist-sans), var(--font-serif-jp), sans-serif',
  fontSize: 12,
});

interface MermaidProps {
  chart: string;
  className?: string;
  zoomingEnabled?: boolean;
}

const FullScreenModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setZoom(1);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div ref={modalRef} className="bg-[var(--card-bg)] rounded-lg shadow-custom max-w-5xl max-h-[90vh] w-full overflow-hidden flex flex-col card-japanese">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="font-medium text-[var(--foreground)]">Diagram View</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="text-[var(--foreground)] hover:bg-[var(--accent-primary)]/10 p-2 rounded-md border border-[var(--border-color)]" aria-label="Zoom out">-</button>
              <span className="text-sm text-[var(--muted)]">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="text-[var(--foreground)] hover:bg-[var(--accent-primary)]/10 p-2 rounded-md border border-[var(--border-color)]" aria-label="Zoom in">+</button>
              <button onClick={() => setZoom(1)} className="text-[var(--foreground)] hover:bg-[var(--accent-primary)]/10 p-2 rounded-md border border-[var(--border-color)]" aria-label="Reset">⟲</button>
            </div>
            <button onClick={onClose} className="text-[var(--foreground)] hover:bg-[var(--accent-primary)]/10 p-2 rounded-md border border-[var(--border-color)]" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="overflow-auto p-6 flex-1 flex items-center justify-center bg-[var(--background)]/50">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.3s ease-out' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const Mermaid: React.FC<MermaidProps> = ({ chart, className = '', zoomingEnabled = false }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substring(2, 9)}`);
  const isDarkModeRef = useRef(
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (svg && zoomingEnabled && containerRef.current) {
      const initializePanZoom = async () => {
        const svgElement = containerRef.current?.querySelector("svg");
        if (svgElement) {
          svgElement.style.maxWidth = "none";
          svgElement.style.width = "100%";
          svgElement.style.height = "100%";
          try {
            const svgPanZoom = (await import("svg-pan-zoom")).default;
            svgPanZoom(svgElement, { zoomEnabled: true, controlIconsEnabled: true, fit: true, center: true, minZoom: 0.1, maxZoom: 10, zoomScaleSensitivity: 0.3 });
          } catch (err) { console.error("Failed to load svg-pan-zoom:", err); }
        }
      };
      setTimeout(() => { void initializePanZoom(); }, 100);
    }
  }, [svg, zoomingEnabled]);

  useEffect(() => {
    if (!chart) return;
    let isMounted = true;
    const renderChart = async () => {
      if (!isMounted) return;
      try {
        setError(null);
        setSvg('');
        const { svg: renderedSvg } = await mermaid.render(idRef.current, chart);
        if (!isMounted) return;
        let processedSvg = renderedSvg;
        if (isDarkModeRef.current) {
          processedSvg = processedSvg.replace('<svg ', '<svg data-theme="dark" ');
        }
        setSvg(processedSvg);
        setTimeout(() => { mermaid.contentLoaded(); }, 50);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (isMounted) {
          setError(`Failed to render diagram`);
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = `<pre class="text-xs overflow-auto p-2 bg-gray-100 dark:bg-gray-800 rounded">${chart}</pre>`;
          }
        }
      }
    };
    renderChart();
    return () => { isMounted = false; };
  }, [chart]);

  if (error) {
    return (
      <div className={`border border-[var(--highlight)]/30 rounded-md p-4 bg-[var(--highlight)]/5 ${className}`}>
        <div className="text-[var(--highlight)] text-xs font-medium mb-2">Diagram rendering error</div>
        <div ref={mermaidRef} className="text-xs overflow-auto"></div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`flex justify-center items-center p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-[var(--accent-primary)]/70 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-[var(--accent-primary)]/70 rounded-full animate-pulse delay-75"></div>
          <div className="w-2 h-2 bg-[var(--accent-primary)]/70 rounded-full animate-pulse delay-150"></div>
          <span className="text-[var(--muted)] text-xs ml-2">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className={`w-full max-w-full ${zoomingEnabled ? "h-[600px] p-4" : ""}`}>
        <div className={`relative group ${zoomingEnabled ? "h-full rounded-lg border-2 border-black" : ""}`}>
          <div
            className={`flex justify-center overflow-auto text-center my-2 cursor-pointer hover:shadow-md transition-shadow duration-200 rounded-md ${className} ${zoomingEnabled ? "h-full" : ""}`}
            dangerouslySetInnerHTML={{ __html: svg }}
            onClick={zoomingEnabled ? undefined : () => setIsFullscreen(true)}
            title={zoomingEnabled ? undefined : "Click to view fullscreen"}
          />
          {!zoomingEnabled && (
            <div className="absolute top-2 right-2 bg-gray-700/70 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs pointer-events-none">
              Click to zoom
            </div>
          )}
        </div>
      </div>
      {!zoomingEnabled && (
        <FullScreenModal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </FullScreenModal>
      )}
    </>
  );
};

export default Mermaid;
