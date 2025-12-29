import { Palette } from '../types';

export const PALETTES: Palette[] = [
  {
    id: 'bw',
    name: '1-Bit Black & White',
    colors: [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ],
  },
  {
    id: 'gameboy',
    name: 'Gameboy (Classic)',
    colors: [
      { r: 15, g: 56, b: 15 },
      { r: 48, g: 98, b: 48 },
      { r: 139, g: 172, b: 15 },
      { r: 155, g: 188, b: 15 },
    ],
  },
  {
    id: 'cga1',
    name: 'CGA (Palette 1 High)',
    colors: [
      { r: 0, g: 0, b: 0 },
      { r: 85, g: 255, b: 255 },
      { r: 255, g: 85, b: 255 },
      { r: 255, g: 255, b: 255 },
    ],
  },
  {
    id: 'mac',
    name: 'Macintosh II',
    colors: [
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 255, b: 0 },
      { r: 255, g: 102, b: 0 },
      { r: 221, g: 0, b: 0 },
      { r: 255, g: 0, b: 153 },
      { r: 51, g: 0, b: 153 },
      { r: 0, g: 0, b: 204 },
      { r: 0, g: 153, b: 255 },
      { r: 0, g: 170, b: 0 },
      { r: 0, g: 102, b: 0 },
      { r: 102, g: 51, b: 0 },
      { r: 153, g: 102, b: 51 },
      { r: 187, g: 187, b: 187 },
      { r: 136, g: 136, b: 136 },
      { r: 68, g: 68, b: 68 },
      { r: 0, g: 0, b: 0 },
    ],
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    colors: [
      { r: 255, g: 113, b: 206 },
      { r: 1, g: 205, b: 254 },
      { r: 5, g: 255, b: 161 },
      { r: 185, g: 103, b: 255 },
      { r: 255, g: 251, b: 150 },
      { r: 45, g: 45, b: 65 },
    ]
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: [
        { r: 15, g: 15, b: 20 },
        { r: 252, g: 224, b: 40 }, // Yellow
        { r: 0, g: 240, b: 255 }, // Cyan
        { r: 255, g: 0, b: 60 }, // Red
        { r: 113, g: 28, b: 145 }, // Purple
    ]
  }
];
