import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import './SharedStyles.css';

const FileUpload = ({ onFilesSelected, multiple = true, accept = "application/pdf", title = "Click or drag to upload", subtitle }) => {
  const fileInputRef = useRef(null);

  const handleDrop = (files) => {
    onFilesSelected(files);
  };

  const { isDragging, handlers } = useDragAndDrop(handleDrop);

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
    // Reset input so same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className={`upload-area ${isDragging ? 'dragging' : ''}`}
      {...handlers}
    >
      <input 
        type="file" 
        multiple={multiple} 
        accept={accept} 
        onChange={handleChange}
        ref={fileInputRef}
        id="file-upload"
        className="hidden-input"
      />
      <label htmlFor="file-upload" className="upload-label">
        <Upload size={48} className={`upload-icon ${isDragging ? 'animate-bounce' : ''}`} />
        <span className="upload-title">{title}</span>
        {subtitle && <span className="upload-subtitle text-muted">{subtitle}</span>}
      </label>
    </div>
  );
};

export default FileUpload;
