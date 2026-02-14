import React, { useRef } from 'react';

interface FileUploaderProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    label: string;
    description?: string;
    currentFileName?: string;
    disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
    onFileSelect,
    accept = '.xlsx,.xls',
    label,
    description,
    currentFileName,
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect(file);
        }
    };

    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className={`card ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{label}</h3>
            {description && (
                <p className="text-sm text-slate-600 mb-4">{description}</p>
            )}

            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={disabled}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Choose File
                </button>

                {currentFileName && (
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-slate-700">{currentFileName}</span>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
                disabled={disabled}
            />
        </div>
    );
};
