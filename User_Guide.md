# Part 1: User Documentation

## **Dither Pro 2.0 — User Manual**

### **1. Getting Started**
**Dither Pro 2.0** is a professional-grade image processing suite designed to convert high-fidelity images into stylized, retro, or artistic compositions using advanced dithering algorithms and color quantization.

#### **Importing an Image**
1.  **Drag & Drop:** Simply drag an image file (PNG, JPG, WebP) anywhere onto the application window.
2.  **Browse:** Click the "Choose File" button on the start screen to select a file from your device.

---

### **2. The Interface**
Once an image is loaded, the interface allows for split-screen comparison and deep customization.

*   **The Canvas:** Shows your processed image.
*   **Split View:** Click the **Columns Icon** in the bottom floating toolbar to enable "Compare Mode." Drag the slider handle left/right to compare the Original vs. Processed image.
*   **Zoom & Pan:**
    *   **Zoom:** Use `Ctrl + Scroll` or the `+ / -` buttons in the bottom toolbar.
    *   **Pan:** Click and drag the image to move around when zoomed in.
*   **History:** Use the `Undo` and `Redo` buttons (top right) or keyboard shortcuts (`Ctrl+Z` / `Ctrl+Y`) to step through your changes.

---

### **3. Dithering Controls (Tab 1)**
This tab controls how pixels are arranged to simulate shading.

#### **Algorithm Selection**
Choose from industry-standard algorithms:
*   **Error Diffusion:** *Floyd-Steinberg, Atkinson, Stucki, Burkes, Sierra.* These provide organic, high-quality shading.
*   **Ordered:** *Bayer (2x2, 4x4, 8x8).* Creates a structured, cross-hatch grid pattern (classic retro aesthetic).
*   **Halftone:** *Cluster Dot.* Simulates newspaper or comic book printing.
*   **Artistic:** *Random Noise* or *Threshold* (hard cut).

#### **Settings**
*   **Serpentine Scan:** (Error Diffusion only) Scans pixels back-and-forth instead of left-to-right. Enabling this reduces "worm" artifacts in the dithering pattern.
*   **Pixel Scale:** Downsamples the resolution (1x, 2x, 4x, 8x) to create a "pixel art" chunky aesthetic without resizing the actual file output.
*   **Dither Strength:** Controls how much error diffusion is applied. Lower values create a "posterized" look; higher values create smoother gradients.

---

### **4. Color Processing**
Dither Pro 2.0 offers two ways to handle color: **Preset Palettes** or **Dynamic Quantization**.

#### **A. Preset Palettes**
Select a classic hardware look from the dropdown:
*   *1-Bit B&W, Gameboy, Macintosh II, CGA, Vaporwave, Cyberpunk.*

#### **B. Dynamic Quantization (Generate Palette)**
Check **"Generate Palette"** to have the app mathematically calculate the best colors for your specific image.
*   **Algorithm:**
    *   *Median Cut:* Balanced, high-quality color selection.
    *   *Popularity:* Selects the colors that appear most frequently.
*   **Max Colors:** Define exactly how many colors the final image will use (2 to 128).

#### **Metric**
*   **Euclidean:** Standard mathematical color matching.
*   **Redmean:** Perceptually accurate matching based on how the human eye perceives brightness and color distance.

---

### **5. Enhancements (Tab 2)**
Pre-process your image before dithering for better results.

*   **Tone:** Adjust Brightness and Contrast. High contrast often produces cleaner dithered results.
*   **Color:** Adjust Saturation or force Greyscale.
*   **Detail:**
    *   *Blur:* Softens the image to reduce noise before dithering.
    *   *Sharpen:* Accentuates edges to make the dither pattern "snap" to details.

---

### **6. Exporting**
Click the **Export PNG** button in the top right header. The image is processed at full resolution client-side and downloaded immediately to your device.

---

