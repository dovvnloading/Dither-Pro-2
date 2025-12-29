import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Download, RefreshCw, X, Sparkles, Loader2, ZoomIn, ZoomOut, Maximize, Search, Undo, Redo, Zap, Palette as PaletteIcon, Info, Columns, Workflow, Code2, Heart, Github, Globe, Cpu, Layers } from 'lucide-react';
import { Button, Select, Slider, Label } from './components/UIComponents';
import { ImageUploader } from './components/ImageUploader';
import { NodeGraph } from './components/NodeGraph';
import { createWorker } from './utils/processor';
import { PALETTES } from './utils/constants';
import { DitherMethod, DitherSettings, ColorMetric, QuantizationAlgorithm } from './types';

// Debounce helper to prevent excessive worker messages
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const DEFAULT_SETTINGS: DitherSettings = {
  method: DitherMethod.FLOYD_STEINBERG,
  paletteId: 'bw',
  pixelSize: 1,
  contrast: 1.0,
  brightness: 0,
  greyscale: false,
  serpentine: false,
  colorMetric: 'euclidean',
  ditherStrength: 1.0,
  useQuantization: false,
  quantizationAlgo: QuantizationAlgorithm.MEDIAN_CUT,
  maxColors: 8,
  saturation: 1.0,
  blur: 0,
  sharpen: 0,
  invert: false
};

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'dither' | 'enhance'>('dither');
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [originalImageURL, setOriginalImageURL] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  // UX States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageURL, setProcessedImageURL] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showNodeGraph, setShowNodeGraph] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePos, setComparePos] = useState(50);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  
  // Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Panning State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Settings State
  const [settings, setSettings] = useState<DitherSettings>(DEFAULT_SETTINGS);

  // History State
  const [history, setHistory] = useState<DitherSettings[]>([DEFAULT_SETTINGS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const debouncedSettings = useDebounce(settings, 100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  // Check if current method supports serpentine (Error diffusion only)
  const supportsSerpentine = !settings.method.includes('Bayer') && 
                             !settings.method.includes('Cluster') && 
                             !settings.method.includes('Threshold') && 
                             !settings.method.includes('Random');

  // Theme Toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Undo/Redo Logic
  const commitSettings = (snapshot: DitherSettings) => {
    const currentHead = history[historyIndex];
    // Check equality to avoid duplicate history entries
    if (JSON.stringify(currentHead) === JSON.stringify(snapshot)) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const updateSettingAndCommit = (newSettings: DitherSettings) => {
    setSettings(newSettings);
    commitSettings(newSettings);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSettings(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSettings(history[newIndex]);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
          e.preventDefault();
          redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Initialize Worker
  useEffect(() => {
    const worker = createWorker();
    
    worker.onmessage = (e) => {
      const { id, success, imageData } = e.data;
      
      // Only process the latest request
      if (id === requestIdRef.current) {
        if (success && imageData && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = imageData.width;
            canvasRef.current.height = imageData.height;
            ctx.putImageData(imageData, 0, 0);
            setProcessedImageURL(canvasRef.current.toDataURL('image/png'));
          }
        }
        setIsProcessing(false);
      }
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Image Processing Effect
  useEffect(() => {
    if (!originalImage || !workerRef.current) return;

    const updateImage = async () => {
      setIsProcessing(true);
      
      // Increment request ID
      const currentId = requestIdRef.current + 1;
      requestIdRef.current = currentId;

      try {
        const currentPalette = PALETTES.find(p => p.id === debouncedSettings.paletteId) || PALETTES[0];
        
        // 1. Handle Pixel Size (Resizing) on Main Thread (Fast)
        const targetWidth = Math.ceil(originalImage.width / debouncedSettings.pixelSize);
        const targetHeight = Math.ceil(originalImage.height / debouncedSettings.pixelSize);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) {
           setIsProcessing(false);
           return;
        }

        // Draw resized image
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = originalImage.width;
        resizeCanvas.height = originalImage.height;
        const resizeCtx = resizeCanvas.getContext('2d');
        if(!resizeCtx) {
           setIsProcessing(false);
           return;
        }
        
        resizeCtx.putImageData(originalImage, 0, 0);
        tempCtx.drawImage(resizeCanvas, 0, 0, targetWidth, targetHeight);
        
        const downscaledData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);

        // 2. Offload Dithering to Worker
        workerRef.current?.postMessage({
          id: currentId,
          imageData: downscaledData,
          method: debouncedSettings.method,
          palette: currentPalette,
          contrast: debouncedSettings.contrast,
          brightness: debouncedSettings.brightness,
          greyscale: debouncedSettings.greyscale,
          serpentine: debouncedSettings.serpentine,
          colorMetric: debouncedSettings.colorMetric,
          ditherStrength: debouncedSettings.ditherStrength,
          quantization: {
            enabled: debouncedSettings.useQuantization,
            algo: debouncedSettings.quantizationAlgo,
            maxColors: debouncedSettings.maxColors
          },
          enhancements: {
            saturation: debouncedSettings.saturation,
            blur: debouncedSettings.blur,
            sharpen: debouncedSettings.sharpen,
            invert: debouncedSettings.invert
          }
        });

      } catch (e) {
        console.error("Setup failed", e);
        setIsProcessing(false);
      }
    };

    updateImage();
  }, [originalImage, debouncedSettings]);

  // Zoom Logic
  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.max(0.1, Math.min(20, newZoom)));
  };

  const fitToScreen = () => {
    if (!originalImage || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const padding = 64; // padding
    const wRatio = (container.clientWidth - padding) / originalImage.width;
    const hRatio = (container.clientHeight - padding) / originalImage.height;
    
    // Fit to screen, but don't exceed 100% scale initially.
    const fitZoom = Math.min(wRatio, hRatio, 1);
    
    handleZoomChange(fitZoom);
  };

  // Initial Fit
  useEffect(() => {
    if (originalImage) {
      setTimeout(fitToScreen, 0);
    }
  }, [originalImage]);

  // Wheel Zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !originalImage) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = 0.002 * delta; 
        setZoom(z => Math.max(0.1, Math.min(20, z * (1 + factor))));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [originalImage]);


  // Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ 
      x: scrollContainerRef.current.scrollLeft, 
      y: scrollContainerRef.current.scrollTop 
    });
    e.preventDefault(); // Prevent text selection
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    scrollContainerRef.current.scrollLeft = scrollStart.x - dx;
    scrollContainerRef.current.scrollTop = scrollStart.y - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Compare Slider Global Drag
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isSliderDragging && imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setComparePos(percent);
      }
    };
    const handleGlobalUp = () => setIsSliderDragging(false);

    if (isSliderDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isSliderDragging]);


  const handleDownload = () => {
    if (processedImageURL) {
      const link = document.createElement('a');
      link.download = `dithered-${fileName.replace(/\.[^/.]+$/, "")}.png`;
      link.href = processedImageURL;
      link.click();
    }
  };

  const handleReset = () => {
    updateSettingAndCommit(DEFAULT_SETTINGS);
  };

  const methodOptions = Object.values(DitherMethod).map(m => ({ label: m, value: m }));
  const paletteOptions = PALETTES.map(p => ({ label: `${p.name} (${p.colors.length} colors)`, value: p.id }));
  const quantAlgoOptions = Object.values(QuantizationAlgorithm).map(a => ({ label: a, value: a }));

  const colorMetricOptions = [
      { label: 'Euclidean (Standard)', value: 'euclidean' },
      { label: 'Redmean (Perceptual)', value: 'redmean' }
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-cover bg-center bg-fixed relative overflow-hidden bg-zinc-100 dark:bg-zinc-950 transition-colors duration-500">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-zinc-300/20 dark:bg-zinc-800/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gray-400/20 dark:bg-zinc-800/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="h-16 shrink-0 border-b border-white/20 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl flex items-center justify-between px-6 z-20 transition-colors duration-300">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-300 dark:border-zinc-700 transition-colors">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono text-sm leading-none">Dp</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Dither Pro <span className="text-xs font-mono font-normal opacity-50 ml-1">v2.0</span>
            </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary"
            onClick={undo}
            disabled={historyIndex === 0}
            className="w-10 h-10 !px-0 rounded-lg"
            title="Undo (Ctrl+Z)"
           >
             <Undo className="w-5 h-5" />
           </Button>
           <Button 
            variant="secondary"
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="w-10 h-10 !px-0 rounded-lg"
            title="Redo (Ctrl+Y)"
           >
             <Redo className="w-5 h-5" />
           </Button>
           <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-2" />
           <Button 
            variant="secondary" 
            onClick={() => setShowNodeGraph(true)}
            className="w-10 h-10 !px-0 rounded-lg text-accent-600 dark:text-accent-400"
            title="View Node Graph"
            aria-label="View Node Graph"
          >
            <Workflow className="w-5 h-5" />
          </Button>
           <Button 
            variant="secondary" 
            onClick={() => setShowInfo(true)}
            className="w-10 h-10 !px-0 rounded-lg"
            title="About"
            aria-label="About"
          >
            <Info className="w-5 h-5" />
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 !px-0 rounded-lg"
            aria-label="Toggle Theme"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          {originalImage && (
             <Button variant="primary" icon={Download} onClick={handleDownload}>
               Export PNG
             </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden z-10">
        
        {/* Controls Sidebar */}
        <aside className="w-80 shrink-0 border-r border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl overflow-y-auto hidden md:flex flex-col transition-colors duration-300">
          
          {/* Tab Navigation */}
          <div className="p-4 pb-2">
            <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-700/50">
              <button
                onClick={() => setActiveTab('dither')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'dither' 
                  ? 'bg-white dark:bg-zinc-700 text-accent-600 dark:text-accent-400 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'
                }`}
              >
                Dither
              </button>
              <button
                onClick={() => setActiveTab('enhance')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'enhance' 
                  ? 'bg-white dark:bg-zinc-700 text-accent-600 dark:text-accent-400 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'
                }`}
              >
                Enhance
              </button>
            </div>
          </div>

          <div className="p-6 pt-2 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            
            {/* DITHER TAB CONTENT */}
            {activeTab === 'dither' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Algorithm Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                    <h2 className="font-semibold text-sm uppercase tracking-wide">Algorithm</h2>
                  </div>
                  <div>
                    <Label>Dithering Method</Label>
                    <Select 
                        value={settings.method} 
                        onChange={(val) => updateSettingAndCommit({...settings, method: val as DitherMethod})}
                        options={methodOptions}
                    />
                  </div>
                  
                  {supportsSerpentine && (
                      <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium">Serpentine Scan</span>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={settings.serpentine}
                                onChange={(e) => updateSettingAndCommit({...settings, serpentine: e.target.checked})}
                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-accent-600 focus:ring-accent-500"
                            />
                      </div>
                  )}

                  <div>
                      <Label>Pixel Scale (Downsample)</Label>
                      <div className="flex gap-2">
                        {[1, 2, 4, 8].map(size => (
                            <button 
                                key={size}
                                onClick={() => updateSettingAndCommit({...settings, pixelSize: size})}
                                className={`flex-1 py-2 text-xs font-mono rounded-md border transition-all ${
                                    settings.pixelSize === size 
                                    ? 'bg-accent-600 border-accent-600 text-white shadow-md shadow-accent-500/20' 
                                    : 'bg-white/10 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:text-zinc-300'
                                }`}
                            >
                                {size}x
                            </button>
                        ))}
                      </div>
                  </div>

                  <div>
                    <Slider 
                        label="Dither Strength"
                        min={0} max={1} step={0.05}
                        value={settings.ditherStrength}
                        valueDisplay={`${Math.round(settings.ditherStrength * 100)}%`}
                        onChange={(e) => setSettings({...settings, ditherStrength: parseFloat(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        disabled={settings.method === DitherMethod.THRESHOLD}
                    />
                  </div>
                </div>

                <hr className="border-zinc-200 dark:border-white/10" />

                {/* Color Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                    <RefreshCw className="w-5 h-5" />
                    <h2 className="font-semibold text-sm uppercase tracking-wide">Color Processing</h2>
                  </div>

                  {/* Palette Mode Selection */}
                  <div className="p-3 bg-white/50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PaletteIcon className="w-4 h-4 text-pink-500" />
                          <span className="text-sm font-medium">Generate Palette</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.useQuantization}
                          onChange={(e) => updateSettingAndCommit({...settings, useQuantization: e.target.checked})}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-accent-600 focus:ring-accent-500"
                        />
                    </div>
                    
                    {settings.useQuantization && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                          <div>
                            <Label>Algorithm</Label>
                            <Select 
                              value={settings.quantizationAlgo}
                              onChange={(val) => updateSettingAndCommit({...settings, quantizationAlgo: val as QuantizationAlgorithm})}
                              options={quantAlgoOptions}
                            />
                          </div>
                          <div>
                            <Label>Max Colors</Label>
                            <Slider 
                              min={2} max={128} step={1}
                              value={settings.maxColors}
                              onChange={(e) => setSettings({...settings, maxColors: parseInt(e.target.value)})}
                              onMouseUp={() => commitSettings(settings)}
                              onTouchEnd={() => commitSettings(settings)}
                              onKeyUp={() => commitSettings(settings)}
                              label=""
                              valueDisplay={settings.maxColors.toString()}
                            />
                          </div>
                        </div>
                    )}
                  </div>

                  {!settings.useQuantization && (
                    <div className="animate-in fade-in duration-200">
                      <Label>Palette Preset</Label>
                      <Select 
                          value={settings.paletteId} 
                          onChange={(val) => updateSettingAndCommit({...settings, paletteId: val})}
                          options={paletteOptions}
                      />
                      
                      {/* Palette Preview */}
                      <div className="flex flex-wrap gap-1 mt-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 transition-colors">
                          {PALETTES.find(p => p.id === settings.paletteId)?.colors.map((c, i) => (
                              <div 
                                key={i} 
                                className="w-6 h-6 rounded-sm shadow-sm border border-black/10" 
                                style={{ backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }} 
                                title={`R${c.r} G${c.g} B${c.b}`}
                              />
                          ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Color Matching Metric</Label>
                    <Select 
                        value={settings.colorMetric} 
                        onChange={(val) => updateSettingAndCommit({...settings, colorMetric: val as ColorMetric})}
                        options={colorMetricOptions}
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {settings.colorMetric === 'redmean' 
                        ? "Perceptually accurate to human eyes." 
                        : "Mathematically strict distance."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ENHANCE TAB CONTENT */}
            {activeTab === 'enhance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                    <h2 className="font-semibold text-sm uppercase tracking-wide">Adjustments</h2>
                 </div>

                 <div className="space-y-4">
                   <Label>Tone</Label>
                   <div className="bg-white/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
                     <Slider 
                        min={-0.5} max={0.5} step={0.05} 
                        value={settings.brightness} 
                        onChange={(e) => setSettings({...settings, brightness: parseFloat(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        label="Brightness"
                        valueDisplay={settings.brightness.toFixed(2)}
                     />
                     
                     <Slider 
                        min={0.5} max={2.0} step={0.1} 
                        value={settings.contrast} 
                        onChange={(e) => setSettings({...settings, contrast: parseFloat(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        label="Contrast"
                        valueDisplay={settings.contrast.toFixed(1)}
                     />

                     <div className="flex items-center justify-between">
                         <Label>Invert Colors</Label>
                         <input 
                            type="checkbox" 
                            checked={settings.invert}
                            onChange={(e) => updateSettingAndCommit({...settings, invert: e.target.checked})}
                            className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-accent-600 focus:ring-accent-500"
                        />
                     </div>
                   </div>

                   <Label>Color & Saturation</Label>
                   <div className="bg-white/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
                      <Slider 
                        min={0} max={2} step={0.1} 
                        value={settings.saturation} 
                        onChange={(e) => setSettings({...settings, saturation: parseFloat(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        label="Saturation"
                        valueDisplay={settings.saturation.toFixed(1)}
                     />
                     <div className="flex items-center justify-between">
                        <Label>Grayscale</Label>
                        <input 
                            type="checkbox" 
                            checked={settings.greyscale}
                            onChange={(e) => updateSettingAndCommit({...settings, greyscale: e.target.checked})}
                            className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-accent-600 focus:ring-accent-500"
                        />
                     </div>
                   </div>

                   <Label>Detail</Label>
                   <div className="bg-white/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
                     <Slider 
                        min={0} max={10} step={1} 
                        value={settings.blur} 
                        onChange={(e) => setSettings({...settings, blur: parseInt(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        label="Blur"
                        valueDisplay={settings.blur.toString()}
                     />
                     <Slider 
                        min={0} max={10} step={1} 
                        value={settings.sharpen} 
                        onChange={(e) => setSettings({...settings, sharpen: parseInt(e.target.value)})}
                        onMouseUp={() => commitSettings(settings)}
                        onTouchEnd={() => commitSettings(settings)}
                        onKeyUp={() => commitSettings(settings)}
                        label="Sharpen"
                        valueDisplay={settings.sharpen.toString()}
                     />
                   </div>
                 </div>

              </div>
            )}
            
            <div className="pt-4 mt-auto">
                <Button variant="secondary" className="w-full" onClick={handleReset}>
                    Reset All Settings
                </Button>
            </div>

          </div>
        </aside>

        {/* Canvas Area */}
        <section className="flex-1 relative overflow-hidden bg-zinc-50/50 dark:bg-black/20 transition-colors duration-300">
          {!originalImage ? (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="w-full max-w-xl animate-in fade-in zoom-in duration-500">
                <ImageUploader onImageLoad={(data, name, url) => {
                  setOriginalImage(data);
                  setFileName(name);
                  setOriginalImageURL(url);
                  // Reset history on new image
                  setSettings(DEFAULT_SETTINGS);
                  setHistory([DEFAULT_SETTINGS]);
                  setHistoryIndex(0);
                }} />
              </div>
            </div>
          ) : (
            <>
              {/* Scrollable Container */}
              <div 
                ref={scrollContainerRef} 
                className={`absolute inset-0 overflow-auto flex p-16 custom-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className="m-auto relative group flex flex-col items-center min-w-0 min-h-0 pointer-events-none">
                  {/* Image Container */}
                  <div 
                    ref={imageContainerRef}
                    className="relative shadow-2xl shadow-black/40 border-[8px] border-white dark:border-zinc-800 rounded-sm overflow-hidden transition-colors duration-300 bg-white dark:bg-zinc-900 pointer-events-auto"
                    style={{
                      width: originalImage.width * zoom,
                      height: originalImage.height * zoom,
                    }}
                  >
                    {/* Comparison Overlay Layer (Base = Processed) */}
                    <canvas 
                        ref={canvasRef} 
                        className="block w-full h-full object-contain transition-opacity duration-200 absolute inset-0"
                        style={{ imageRendering: 'pixelated' }}
                    />

                    {/* Original Image Layer (Clipped on top) */}
                    {compareMode && originalImageURL && (
                      <>
                        <img 
                          src={originalImageURL}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          style={{ 
                            imageRendering: 'pixelated',
                            clipPath: `inset(0 ${100 - comparePos}% 0 0)` 
                          }}
                          alt="Original"
                        />
                        {/* Slider Handle */}
                        <div 
                            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize hover:bg-accent-400 transition-colors shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 flex flex-col justify-center items-center group"
                            style={{ left: `${comparePos}%` }}
                            onMouseDown={(e) => {
                                e.stopPropagation(); 
                                setIsSliderDragging(true);
                            }}
                        >
                            <div className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-900 scale-90 group-hover:scale-110 transition-transform">
                                <div className="w-4 h-4 text-[10px] font-bold flex items-center justify-center gap-[1px]">
                                   <span>‹</span><span>›</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Comparison Labels */}
                         <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded text-xs font-bold pointer-events-none border border-white/10 z-10 shadow-lg">Original</div>
                         <div className="absolute top-4 right-4 bg-accent-600/80 backdrop-blur-md text-white px-2 py-1 rounded text-xs font-bold pointer-events-none border border-white/10 z-10 shadow-lg">Dithered</div>
                      </>
                    )}
                    
                    {/* Loading Overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-30">
                        <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                          <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
                          <span>Processing...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Floating Zoom Toolbar */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-white/20 dark:border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-2 z-30 transition-all duration-300 hover:bg-white/90 dark:hover:bg-zinc-900/90 hover:scale-105">
                <button 
                  onClick={() => handleZoomChange(zoom / 1.2)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                
                <span className="w-16 text-center font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-300 select-none">
                  {Math.round(zoom * 100)}%
                </span>
                
                <button 
                  onClick={() => handleZoomChange(zoom * 1.2)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                
                <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                <button 
                  onClick={() => setCompareMode(!compareMode)}
                  className={`p-2 rounded-xl transition-all ${compareMode ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/30' : 'text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                  title="Toggle Split Comparison"
                >
                  <Columns className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                <button 
                  onClick={fitToScreen}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 transition-colors"
                  title="Fit to Screen"
                >
                  <Maximize className="w-5 h-5" />
                </button>
                 <button 
                  onClick={() => handleZoomChange(1)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-zinc-600 dark:text-zinc-300 transition-colors"
                  title="1:1 Original Size"
                >
                  <Search className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                <button 
                  onClick={() => {
                    setOriginalImage(null);
                    setProcessedImageURL(null);
                    setOriginalImageURL(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
              
              {/* Zoom Hint */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400 dark:text-zinc-600 pointer-events-none select-none opacity-0 md:opacity-100 transition-opacity">
                 Drag to pan • Ctrl + Scroll to zoom • Ctrl+Z to Undo
              </div>
            </>
          )}
        </section>
      </main>
      
      {/* Node Graph Modal */}
      <NodeGraph 
        isOpen={showNodeGraph} 
        onClose={() => setShowNodeGraph(false)} 
        settings={debouncedSettings} 
      />

      {/* Info / Credits Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            className="relative w-full max-w-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Decorative Grid Background */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ 
                    backgroundImage: 'radial-gradient(circle, #808080 1px, transparent 1px)', 
                    backgroundSize: '24px 24px' 
                  }} 
            />

            {/* Left Side: Visuals (The Nodes) */}
            <div className="relative w-full md:w-1/2 h-64 md:h-[400px] bg-zinc-100/50 dark:bg-black/20 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-white/5 flex items-center justify-center overflow-hidden select-none">
              
               {/* Background Grid */}
               <div className="absolute inset-0 opacity-20 pointer-events-none" 
                    style={{ 
                      backgroundImage: 'radial-gradient(circle, #808080 1px, transparent 1px)', 
                      backgroundSize: '20px 20px' 
                    }} 
               />

               {/* Graph Container Wrapper to ensure consistent coordinate space */}
               <div className="relative w-[400px] h-[300px]">
                    
                    {/* Wire SVG */}
                     <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        <style>
                            {`@keyframes dash { to { stroke-dashoffset: -20; } }`}
                        </style>
                        <path 
                            d="M 170 94 C 220 94, 130 224, 180 224" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="6"
                            className="text-zinc-500/20 dark:text-zinc-500/30"
                        />
                        <path 
                            d="M 170 94 C 220 94, 130 224, 180 224" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeDasharray="10 10"
                            className="text-accent-500 animate-[dash_1s_linear_infinite]"
                        />
                        {/* Connection Dots */}
                        <circle cx="170" cy="94" r="3" className="fill-zinc-500" />
                        <circle cx="180" cy="224" r="4" className="fill-accent-500" />
                     </svg>

                    {/* Node 1: Architecture */}
                    <div className="absolute" style={{ top: '30px', left: '10px', width: '160px' }}>
                        <div className="relative bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl hover:scale-105 transition-transform duration-300" style={{ height: '128px' }}>
                             {/* Port Right */}
                             <div 
                                className="absolute bg-zinc-200 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-500 rounded-full z-20"
                                style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    top: '50%', 
                                    right: '-6px', 
                                    transform: 'translateY(-50%)' 
                                }} 
                             />
                             
                             <div className="flex items-center gap-3 mb-2 pb-2 border-b border-zinc-100 dark:border-white/5">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20">
                                    <Cpu className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">System</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-100 text-xs">Architecture</span>
                                </div>
                             </div>
                             <div className="space-y-1">
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-violet-400" />
                                    React + Vite
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-violet-400" />
                                    Web Workers
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-violet-400" />
                                    OffscreenCanvas
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Node 2: Author */}
                     <div className="absolute" style={{ top: '160px', left: '180px', width: '160px' }}>
                        <div className="relative bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl hover:scale-105 transition-transform duration-300" style={{ height: '128px' }}>
                             {/* Port Left */}
                             <div 
                                className="absolute bg-zinc-200 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-500 rounded-full z-20"
                                style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    top: '50%', 
                                    left: '-6px', 
                                    transform: 'translateY(-50%)' 
                                }} 
                             />
                             
                             <div className="flex items-center gap-3 mb-2 pb-2 border-b border-zinc-100 dark:border-white/5">
                                <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-500/20">
                                    <Heart className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Output</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-100 text-xs">Created By</span>
                                </div>
                             </div>
                             <div className="space-y-1">
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-pink-400" />
                                    Matthew R. Wesney
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-pink-400" />
                                    MIT License
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-pink-400" />
                                    Open Source
                                </div>
                             </div>
                        </div>
                    </div>

               </div>
            </div>

            {/* Right Side: Content */}
            <div className="w-full md:w-1/2 p-8 flex flex-col justify-center relative">
              <button 
                  onClick={() => setShowInfo(false)}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 transition-colors"
              >
                  <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 text-xs font-bold uppercase tracking-wide mb-4 border border-accent-200 dark:border-accent-700/50">
                      <Sparkles className="w-3 h-3" />
                      v2.0 Release
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Dither Pro</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      A professional-grade image dithering suite built entirely in the browser. High-performance client-side processing using Web Workers and modern web standards.
                  </p>
              </div>

              <div className="space-y-4">
                  <div className="flex items-center gap-4">
                      <a 
                          href="https://github.com/dovvnloading" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-all font-semibold shadow-xl"
                      >
                          <Github className="w-5 h-5" />
                          GitHub
                      </a>
                      <a 
                          href="https://dovvnloading.github.io/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-semibold border border-zinc-200 dark:border-zinc-700"
                      >
                          <Globe className="w-5 h-5" />
                          Website
                      </a>
                  </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span className="font-mono">© 2025 Matthew Robert Wesney</span>
                  <div className="flex gap-2">
                      <span title="React" className="hover:text-accent-500 transition-colors cursor-help"><Code2 className="w-4 h-4"/></span>
                      <span title="Web Workers" className="hover:text-accent-500 transition-colors cursor-help"><Cpu className="w-4 h-4"/></span>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;