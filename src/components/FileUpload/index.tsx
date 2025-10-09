"use client";

import React, { useRef, useEffect, useState } from "react";
import { useSiteData } from '@/contexts/SiteDataContext';
import Image from "next/image";

interface FileUploadProps {
  value?: {
    name?: string;
    source?: string;
  };
  onChange: (file: File, previewUrl: string) => void;
  onClear?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  value,
  onChange,
  onClear,
}) => {
  const siteData = useSiteData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | undefined>(value?.source);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    onChange(file, previewUrl);
  };

  const handleClear = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPreview(undefined);
    if (onClear) onClear();
  };

  useEffect(() => {
    setPreview(value?.source);
  }, [value]);

  return (
    <div className="flex flex-col w-1/2 space-y-2">
        <label
          style={{ color: siteData?.["text-primary"] }}
          className="block text-sm font-medium cursor-pointer rounded-lg"
        >
            Upload <strong>Hero Image</strong>
        </label>

        <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
        />
        {preview && (
            <div style={{ border: `1px solid ${siteData?.["text-primary"]}` }} className="relative w-full mt-2 rounded-lg overflow-hidden">
            <Image
                src={preview}
                alt="Preview"
                width={600}
                height={400}
                className="w-full h-48 object-contain"
            />
            {
                value?.source !== "/heroImage.png" && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute top-2 right-2 bg-white text-red-600 rounded-full p-2 shadow-md hover:bg-gray-100"
                    >
                        ×
                    </button>
                )
            }
            </div>
        )}
        <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: siteData?.primary, color: siteData?.["text-inverse"] }}
            className="w-full cursor-pointer font-medium rounded-lg px-3 py-2 transition-colors"
        >
            {value?.name ? "Change Selected File" : "Select File"}
        </button>
    </div>
  );
};

export default FileUpload;