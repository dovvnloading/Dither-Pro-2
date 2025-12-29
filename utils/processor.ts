import { DitherMethod, Palette } from '../types';

// This function contains the entire worker script scope.
// It must not rely on external variables (closures) that are not defined within it.
const workerLogic = () => {
  // --- Constants & Helpers ---
  
  const bayer2x2 = [
    [0, 2],
    [3, 1]
  ]; 

  const bayer4x4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const bayer8x8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];

  // Simulates varying dot sizes for halftone effects
  const cluster4x4 = [
    [12, 5, 6, 13],
    [4, 0, 1, 7],
    [11, 3, 2, 8],
    [15, 10, 9, 14]
  ];

  const cluster8x8 = [
    [24, 10, 12, 26, 35, 47, 49, 37],
    [8, 0, 2, 14, 45, 59, 61, 49],
    [22, 6, 4, 16, 43, 63, 62, 51],
    [30, 20, 18, 28, 33, 55, 57, 39],
    [34, 46, 48, 36, 25, 11, 13, 27],
    [44, 58, 60, 48, 9, 1, 3, 15],
    [42, 62, 63, 50, 23, 7, 5, 17],
    [32, 54, 56, 38, 31, 21, 19, 29]
  ];

  // Standard Euclidean Distance (Fast)
  const getNearestColorEuclidean = (r: number, g: number, b: number, palette: any) => {
    let minDist = Infinity;
    let nearest = palette.colors[0];

    for (let i = 0; i < palette.colors.length; i++) {
      const color = palette.colors[i];
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      // Simple sum of squares
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearest = color;
      }
    }
    return nearest;
  };

  // "Redmean" Perceptual Distance (Better for human eye)
  // Low-cost approximation of CIELAB
  const getNearestColorRedmean = (r: number, g: number, b: number, palette: any) => {
    let minDist = Infinity;
    let nearest = palette.colors[0];

    for (let i = 0; i < palette.colors.length; i++) {
      const color = palette.colors[i];
      const rBar = (r + color.r) * 0.5;
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;

      // Redmean formula
      const dist = (2 + rBar / 256) * (dr * dr) +
                   4 * (dg * dg) +
                   (2 + (255 - rBar) / 256) * (db * db);

      if (dist < minDist) {
        minDist = dist;
        nearest = color;
      }
    }
    return nearest;
  };

  // --- Quantization Algorithms ---

  // Popularity Algorithm: Just takes the most frequent colors
  const quantizePopularity = (data: Uint8ClampedArray, maxColors: number) => {
    const colorMap: Record<string, number> = {};
    // Sampling step to speed up large images, or 1 for full quality
    const step = 4 * 4; 

    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${r},${g},${b}`;
      colorMap[key] = (colorMap[key] || 0) + 1;
    }

    const sortedColors = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
      .slice(0, maxColors)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return { r, g, b };
      });
      
    // If not enough colors found (solid image), pad with black or duplicate
    if (sortedColors.length === 0) return [{r:0,g:0,b:0}, {r:255,g:255,b:255}];
    return sortedColors;
  };

  // Median Cut Algorithm: Recursively splits RGB space
  const quantizeMedianCut = (data: Uint8ClampedArray, maxColors: number) => {
    // 1. Gather all pixels
    const pixels: {r:number, g:number, b:number}[] = [];
    const step = 4 * 2; // Moderate sampling for speed
    for (let i = 0; i < data.length; i += step) {
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] });
    }

    if (pixels.length === 0) return [{r:0,g:0,b:0}, {r:255,g:255,b:255}];

    // Box structure
    interface Box {
      pixels: {r:number, g:number, b:number}[];
      volume: number; // roughly count of pixels
    }

    let boxes: Box[] = [{ pixels, volume: pixels.length }];

    while (boxes.length < maxColors) {
      let splitIndex = -1;
      let maxRange = -1;
      let splitDim = 'r'; // 'r' | 'g' | 'b'

      // Find the box with the largest color spread
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].pixels.length <= 1) continue;
        
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        const pxs = boxes[i].pixels;
        for (let p of pxs) {
          if (p.r < minR) minR = p.r; if (p.r > maxR) maxR = p.r;
          if (p.g < minG) minG = p.g; if (p.g > maxG) maxG = p.g;
          if (p.b < minB) minB = p.b; if (p.b > maxB) maxB = p.b;
        }
        
        const rRange = maxR - minR;
        const gRange = maxG - minG;
        const bRange = maxB - minB;
        
        const boxMaxRange = Math.max(rRange, gRange, bRange);
        
        if (boxMaxRange > maxRange) {
          maxRange = boxMaxRange;
          splitIndex = i;
          if (boxMaxRange === rRange) splitDim = 'r';
          else if (boxMaxRange === gRange) splitDim = 'g';
          else splitDim = 'b';
        }
      }

      if (splitIndex === -1) break; // Can't split further

      // Split the chosen box
      const boxToSplit = boxes[splitIndex];
      // Sort
      //@ts-ignore
      boxToSplit.pixels.sort((a, b) => a[splitDim] - b[splitDim]);
      
      const mid = Math.floor(boxToSplit.pixels.length / 2);
      const newBox1 = { pixels: boxToSplit.pixels.slice(0, mid), volume: mid };
      const newBox2 = { pixels: boxToSplit.pixels.slice(mid), volume: boxToSplit.pixels.length - mid };

      boxes.splice(splitIndex, 1, newBox1, newBox2);
    }

    // Average colors in boxes
    return boxes.map(box => {
      let r = 0, g = 0, b = 0;
      for (let p of box.pixels) {
        r += p.r;
        g += p.g;
        b += p.b;
      }
      return {
        r: Math.round(r / box.pixels.length),
        g: Math.round(g / box.pixels.length),
        b: Math.round(b / box.pixels.length)
      };
    });
  };

  // --- Filter Logic ---

  const applyConvolution = (inputData: Uint8ClampedArray, width: number, height: number, kernel: number[], divisor: number = 1) => {
    const output = new Uint8ClampedArray(inputData.length);
    const kSize = Math.sqrt(kernel.length);
    const half = Math.floor(kSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx - half));
            const py = Math.min(height - 1, Math.max(0, y + ky - half));
            const offset = (py * width + px) * 4;
            const weight = kernel[ky * kSize + kx];

            r += inputData[offset] * weight;
            g += inputData[offset + 1] * weight;
            b += inputData[offset + 2] * weight;
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = Math.min(255, Math.max(0, r / divisor));
        output[idx+1] = Math.min(255, Math.max(0, g / divisor));
        output[idx+2] = Math.min(255, Math.max(0, b / divisor));
        output[idx+3] = inputData[idx+3]; // Alpha
      }
    }
    return output;
  };

  const process = (
    inputImageData: ImageData,
    method: string,
    providedPalette: any,
    contrast: number,
    brightness: number,
    greyscale: boolean,
    serpentine: boolean,
    colorMetric: string,
    ditherStrength: number,
    quantization: { enabled: boolean, algo: string, maxColors: number },
    enhancements: { saturation: number, blur: number, sharpen: number, invert: boolean }
  ) => {
    const width = inputImageData.width;
    const height = inputImageData.height;
    let inputData = new Uint8ClampedArray(inputImageData.data);
    
    // --- 1. Basic Pre-processing (Point operations) ---
    // We modify inputData in place where possible or create new buffers
    for (let i = 0; i < inputData.length; i += 4) {
      let r = inputData[i];
      let g = inputData[i + 1];
      let b = inputData[i + 2];

      // Invert
      if (enhancements.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      // Brightness
      r += brightness * 255;
      g += brightness * 255;
      b += brightness * 255;

      // Contrast
      r = ((r - 128) * contrast) + 128;
      g = ((g - 128) * contrast) + 128;
      b = ((b - 128) * contrast) + 128;

      // Saturation
      if (enhancements.saturation !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * enhancements.saturation;
        g = gray + (g - gray) * enhancements.saturation;
        b = gray + (b - gray) * enhancements.saturation;
      }

      // Greyscale
      if (greyscale) {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = luminance;
      }
      
      inputData[i] = Math.min(255, Math.max(0, r));
      inputData[i + 1] = Math.min(255, Math.max(0, g));
      inputData[i + 2] = Math.min(255, Math.max(0, b));
    }

    // --- 2. Spatial Filters (Convolution) ---
    // These are expensive, so we check if needed.
    // If both are active, we can run them sequentially.
    
    // Simple 3x3 Sharpen Kernel
    if (enhancements.sharpen > 0) {
      // Scale sharpness strength (kernel center increases with strength)
      // A subtle sharpen adds weight to center and subtracts from neighbors
      // Standard: [0 -1 0; -1 5 -1; 0 -1 0]
      // Mix with original image based on strength
      // For simplicity, we'll apply a fixed kernel and blend, or use strength to determine kernel weights.
      // Let's use a dynamic kernel approach.
      const s = enhancements.sharpen * 0.5; // Scale down for usability
      const kernel = [
        0, -s, 0,
        -s, 4*s + 1, -s,
        0, -s, 0
      ];
      inputData = applyConvolution(inputData, width, height, kernel, 1);
    }

    if (enhancements.blur > 0) {
      // Simple Box Blur 3x3
      // For stronger blur, we can run it multiple times or use larger kernel. 
      // Given "basic enhancements" request, 3x3 box blur is okay.
      // If strength is high, we can run multiple passes or use 5x5.
      // Let's implement a 3x3 box blur and run it `blur` times (up to 3-4 for performance).
      const passes = Math.ceil(enhancements.blur / 2);
      const kernel = [1,1,1, 1,1,1, 1,1,1];
      for(let p=0; p<passes; p++) {
         inputData = applyConvolution(inputData, width, height, kernel, 9);
      }
    }

    // --- 3. Palette Selection / Generation ---
    // (This uses the processed inputData)
    
    let activePalette = providedPalette;

    if (quantization && quantization.enabled) {
      let generatedColors;
      if (quantization.algo === 'Popularity') {
        generatedColors = quantizePopularity(inputData, quantization.maxColors);
      } else {
        generatedColors = quantizeMedianCut(inputData, quantization.maxColors);
      }
      activePalette = {
        id: 'generated',
        name: 'Generated',
        colors: generatedColors
      };
    }

    // Use Float32 for error accumulation (Dithering Stage)
    const outputData = new Uint8ClampedArray(inputData);
    const buffer = new Float32Array(outputData);

    const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const idx = (y * width + x) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
    };

    const addError = (x: number, y: number, er: number, eg: number, eb: number, factor: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const idx = (y * width + x) * 4;
      buffer[idx] += er * factor;
      buffer[idx + 1] += eg * factor;
      buffer[idx + 2] += eb * factor;
    };

    const getNearest = colorMetric === 'redmean' ? getNearestColorRedmean : getNearestColorEuclidean;

    // Ordered Dithering Setup
    let isOrdered = false;
    let thresholdMap: number[][] = [];
    let mapDivisor = 1;

    if (method.includes('Bayer') || method.includes('Cluster')) {
      isOrdered = true;
      if (method.includes('Bayer 2x2')) { thresholdMap = bayer2x2; mapDivisor = 4; }
      else if (method.includes('Bayer 4x4')) { thresholdMap = bayer4x4; mapDivisor = 16; }
      else if (method.includes('Bayer 8x8')) { thresholdMap = bayer8x8; mapDivisor = 64; }
      else if (method.includes('Cluster Dot 4x4')) { thresholdMap = cluster4x4; mapDivisor = 16; }
      else if (method.includes('Cluster Dot 8x8')) { thresholdMap = cluster8x8; mapDivisor = 64; }
    }

    // Main Dither Loop
    for (let y = 0; y < height; y++) {
      // Serpentine Logic: Reverse direction on odd rows if enabled
      const reverse = serpentine && (y % 2 !== 0);
      const startX = reverse ? width - 1 : 0;
      const endX = reverse ? -1 : width;
      const stepX = reverse ? -1 : 1;

      for (let x = startX; x !== endX; x += stepX) {
        const idx = (y * width + x) * 4;
        
        const oldR = buffer[idx];
        const oldG = buffer[idx + 1];
        const oldB = buffer[idx + 2];

        let threshold = 0;

        if (isOrdered) {
          const mapValue = thresholdMap[y % thresholdMap.length][x % thresholdMap[0].length];
          // Scale threshold by ditherStrength (0 = no dithering effect, 1 = full effect)
          threshold = ((mapValue / mapDivisor) - 0.5) * 255 * ditherStrength; 
        }

        let searchR = oldR;
        let searchG = oldG;
        let searchB = oldB;

        if (isOrdered) {
          searchR += threshold;
          searchG += threshold;
          searchB += threshold;
        } else if (method === 'Random Noise') {
          // Scale noise by ditherStrength
          const noise = (Math.random() - 0.5) * 50 * ditherStrength; 
          searchR += noise;
          searchG += noise;
          searchB += noise;
        }

        const nearest = getNearest(searchR, searchG, searchB, activePalette);
        
        setPixel(x, y, nearest.r, nearest.g, nearest.b);

        const errR = oldR - nearest.r;
        const errG = oldG - nearest.g;
        const errB = oldB - nearest.b;

        // Error Diffusion
        if (!isOrdered && method !== 'Threshold' && method !== 'Random Noise') {
          // Helper to handle direction mirroring
          const dist = (dx: number, dy: number, factor: number) => {
             // If reversing (Right -> Left), flip dx
             const actualDx = reverse ? -dx : dx;
             // Scale propagated error by ditherStrength
             addError(x + actualDx, y + dy, errR, errG, errB, factor * ditherStrength);
          };

          switch (method) {
            case 'Floyd-Steinberg':
              dist(1, 0, 7 / 16);
              dist(-1, 1, 3 / 16);
              dist(0, 1, 5 / 16);
              dist(1, 1, 1 / 16);
              break;
            
            case 'Atkinson':
              dist(1, 0, 1 / 8);
              dist(2, 0, 1 / 8);
              dist(-1, 1, 1 / 8);
              dist(0, 1, 1 / 8);
              dist(1, 1, 1 / 8);
              dist(0, 2, 1 / 8);
              break;

            case 'Jarvis, Judice, and Ninke':
              dist(1, 0, 7 / 48);
              dist(2, 0, 5 / 48);
              dist(-2, 1, 3 / 48);
              dist(-1, 1, 5 / 48);
              dist(0, 1, 7 / 48);
              dist(1, 1, 5 / 48);
              dist(2, 1, 3 / 48);
              dist(-2, 2, 1 / 48);
              dist(-1, 2, 3 / 48);
              dist(0, 2, 5 / 48);
              dist(1, 2, 3 / 48);
              dist(2, 2, 1 / 48);
              break;
            
            case 'Stucki':
              dist(1, 0, 8 / 42);
              dist(2, 0, 4 / 42);
              dist(-2, 1, 2 / 42);
              dist(-1, 1, 4 / 42);
              dist(0, 1, 8 / 42);
              dist(1, 1, 4 / 42);
              dist(2, 1, 2 / 42);
              dist(-2, 2, 1 / 42);
              dist(-1, 2, 2 / 42);
              dist(0, 2, 4 / 42);
              dist(1, 2, 2 / 42);
              dist(2, 2, 1 / 42);
              break;

            case 'Burkes':
              dist(1, 0, 8 / 32);
              dist(2, 0, 4 / 32);
              dist(-2, 1, 2 / 32);
              dist(-1, 1, 4 / 32);
              dist(0, 1, 8 / 32);
              dist(1, 1, 4 / 32);
              dist(2, 1, 2 / 32);
              break;

            case 'Sierra':
              dist(1, 0, 5 / 32);
              dist(2, 0, 3 / 32);
              dist(-2, 1, 2 / 32);
              dist(-1, 1, 4 / 32);
              dist(0, 1, 5 / 32);
              dist(1, 1, 4 / 32);
              dist(2, 1, 2 / 32);
              dist(-1, 2, 2 / 32);
              dist(0, 2, 3 / 32);
              dist(1, 2, 2 / 32);
              break;

            case 'Two-Row Sierra':
              dist(1, 0, 4 / 16);
              dist(2, 0, 3 / 16);
              dist(-2, 1, 1 / 16);
              dist(-1, 1, 2 / 16);
              dist(0, 1, 3 / 16);
              dist(1, 1, 2 / 16);
              dist(2, 1, 1 / 16);
              break;

            case 'Sierra Lite':
              dist(1, 0, 2 / 4);
              dist(-1, 1, 1 / 4);
              dist(0, 1, 1 / 4);
              break;
          }
        }
      }
    }

    // Copy buffer back to Uint8ClampedArray for output
    for (let i = 0; i < buffer.length; i++) {
      outputData[i] = buffer[i];
    }

    return new ImageData(outputData, width, height);
  };

  // --- Worker Message Handler ---
  self.onmessage = (e: MessageEvent) => {
    const { id, imageData, method, palette, contrast, brightness, greyscale, serpentine, colorMetric, ditherStrength, quantization, enhancements } = e.data;
    try {
      const result = process(imageData, method, palette, contrast, brightness, greyscale, serpentine, colorMetric, ditherStrength, quantization, enhancements);
      self.postMessage({ id, success: true, imageData: result });
    } catch (err: any) {
      self.postMessage({ id, success: false, error: err.message });
    }
  };
};

export const createWorker = (): Worker => {
  // Convert the function body to a string to act as the worker script
  const code = `(${workerLogic.toString()})()`;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};