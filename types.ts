export enum DitherMethod {
  THRESHOLD = 'Threshold',
  RANDOM = 'Random Noise',
  BAYER_2x2 = 'Bayer 2x2 (Ordered)',
  BAYER_4x4 = 'Bayer 4x4 (Ordered)',
  BAYER_8x8 = 'Bayer 8x8 (Ordered)',
  CLUSTER_4x4 = 'Cluster Dot 4x4 (Halftone)',
  CLUSTER_8x8 = 'Cluster Dot 8x8 (Halftone)',
  FLOYD_STEINBERG = 'Floyd-Steinberg',
  ATKINSON = 'Atkinson',
  JARVIS_JUDICE_NINKE = 'Jarvis, Judice, and Ninke',
  STUCKI = 'Stucki',
  BURKES = 'Burkes',
  SIERRA = 'Sierra',
  TWO_ROW_SIERRA = 'Two-Row Sierra',
  SIERRA_LITE = 'Sierra Lite'
}

export enum QuantizationAlgorithm {
  MEDIAN_CUT = 'Median Cut',
  POPULARITY = 'Popularity',
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  id: string;
  name: string;
  colors: RGB[];
}

export type ColorMetric = 'euclidean' | 'redmean';

export interface DitherSettings {
  method: DitherMethod;
  paletteId: string;
  pixelSize: number; // 1 = original, higher = pixelated
  contrast: number; // 0 to 2
  brightness: number; // -1 to 1
  greyscale: boolean;
  serpentine: boolean; // Back-and-forth scanning to reduce artifacts
  colorMetric: ColorMetric; // Distance calculation method
  ditherStrength: number; // 0.0 to 1.0, affects error diffusion or noise/threshold amount
  
  // Enhancement
  saturation: number; // 0 to 2
  blur: number; // 0 to 10 strength
  sharpen: number; // 0 to 10 strength
  invert: boolean;

  // Quantization (Dynamic Palette)
  useQuantization: boolean;
  quantizationAlgo: QuantizationAlgorithm;
  maxColors: number;
}