import React, { useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { Card } from './UIComponents';

interface ImageUploaderProps {
  onImageLoad: (data: ImageData, fileName: string, dataUrl: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageLoad }) => {
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          onImageLoad(imageData, file.name, result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, [onImageLoad]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed border-2 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group p-8">
      <div className="text-center" onDrop={onDrop} onDragOver={onDragOver}>
        <div className="mx-auto w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 transition-transform duration-300">
          <Upload className="w-10 h-10 text-zinc-400" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Upload your image</h3>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-xs mx-auto">
          Drag and drop your file here, or click to browse. Supports PNG, JPG, WebP.
        </p>
        <label className="inline-flex cursor-pointer">
          <input type="file" className="hidden" accept="image/*" onChange={onInputChange} />
          <span className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-accent-500/20 transition-all">
            Choose File
          </span>
        </label>
      </div>
    </Card>
  );
};