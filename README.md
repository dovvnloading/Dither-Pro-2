<div align="center">

# Dither Pro 2.0
### Professional Image Dithering Suite

<br />

<!-- Tech Stack Badges -->
<p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Web_Workers-EB4034?style=for-the-badge&logo=w3c&logoColor=white" alt="Web Workers" />
</p>

<br />

<p align="center">
  <strong>A high-performance, privacy-focused image processor built for artists, retro enthusiasts, and designers.</strong>
</p>

<br />

<!-- DOWNLOAD BUTTON -->
<a href="https://drive.google.com/file/d/1O58cpS1IODfMPHoZBKDXbY9Wv__rUFPr/view?usp=sharing">
  <img src="https://img.shields.io/badge/Download_Dither_Pro_v2.0-00C853?style=for-the-badge&logo=google-drive&logoColor=white&labelColor=1a1a1a" alt="Download Now" height="50" />
</a>

</div>

<br />
<hr />

## About
**Dither Pro 2.0** is a web-based application designed to bring advanced image dithering algorithms to a modern, accessible interface. Unlike server-side tools, Dither Pro runs entirely in your browser using **Web Workers**, ensuring your photos never leave your device and processing happens in real-time.

Whether you are looking to emulate 1-bit Macintosh graphics, prepare images for E-Ink displays, or create retro "pixel art" aesthetics, Dither Pro provides the granular control needed for professional results.

## Application Gallery

<p align="center">
  <img width="100%" src="https://github.com/user-attachments/assets/a3576b9c-fdb7-41c9-a30d-fd647dcf0305" alt="Main Interface" />
</p>
<p align="center">
  <img width="49%" src="https://github.com/user-attachments/assets/1f471d93-fbe5-4454-8b46-34f4e7d9db06" alt="Comparison View" />
  <img width="49%" src="https://github.com/user-attachments/assets/9211a57d-ceac-4136-bce9-a563590589e0" alt="Palette Settings" />
</p>
<p align="center">
  <img width="49%" src="https://github.com/user-attachments/assets/be37fa39-3e5f-41de-a07e-8e71421f7497" alt="Algorithm Selection" />
  <img width="49%" src="https://github.com/user-attachments/assets/dabc1d5a-01af-4bdd-9733-7fe3c613a5a0" alt="Node Graph" />
</p>

## Key Features

### Advanced Dithering Engines
Access a library of industry-standard error diffusion and ordered dithering algorithms:
*   **Error Diffusion:** Floyd-Steinberg, Atkinson, Jarvis-Judice-Ninke, Stucki, Burkes, Sierra (Lite, 2-Row, 3-Row).
*   **Ordered patterns:** Bayer matrices (2x2, 4x4, 8x8) and Cluster Dot halftones.
*   **Serpentine Scanning:** Reduce linear artifacts by processing pixels in alternating directions.

### Color Science
*   **Custom Palettes:** Built-in presets for Gameboy, CGA, Neon, Vaporwave, and Monochrome.
*   **Dynamic Quantization:** Generate optimized palettes from your source image using Median Cut or Popularity algorithms.
*   **Perceptual Matching:** Toggle between Euclidean distance and "Redmean" color metrics for human-eye accuracy.

### Professional Workflow
*   **Non-Destructive Editing:** Full Undo/Redo history stack.
*   **Live Split-View:** Compare your original image and the dithered output side-by-side in real-time.
*   **Image Enhancement:** Built-in pre-processing for brightness, contrast, saturation, blur, and sharpening.
*   **Pixel Scaling:** Downsample images (1x to 8x) for authentic retro resolution emulation.

### Performance
*   **Client-Side Processing:** No API calls. No uploads. 100% Privacy.
*   **Off-Main-Thread Architecture:** Heavy computation is offloaded to Web Workers, keeping the UI responsive even with 4K images.

## How to Run

Dither Pro 2.0 is distributed as a standalone web package.

1.  **Download** the package from the link above.
2.  **Extract** the contents.
3.  Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).

## License & Credits

**Dither Pro 2.0** is Freeware.
Developed by Matthew R. Wesney.

---
<div align="center">
  <sub>Copyright 2025 Dither Pro Team. All rights reserved.</sub>
</div>
