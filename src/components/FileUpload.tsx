import React, { useRef, useEffect, useState } from "react";

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
        <label className="block text-sm font-medium text-gray-700">
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
            <div className="relative w-full mt-2 border rounded-lg overflow-hidden">
            <img
                src={preview}
                alt="Preview"
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
            className={`w-full text-white font-medium rounded-lg px-3 py-2 
                bg-primary hover:bg-primary-dark transition-colors`}
        >
            {value?.name ? "Change Selected File" : "Select File"}
        </button>
    </div>
  );
};

export default FileUpload;