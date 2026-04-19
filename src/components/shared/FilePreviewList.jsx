import React from 'react';
import { File, Trash2 } from 'lucide-react';
import './SharedStyles.css';

const FilePreviewList = ({ files, onRemove, title }) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="file-list">
      <h3>{title || `Selected Files (${files.length})`}</h3>
      <ul>
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`} className="file-item glass-panel">
            <div className="file-info">
              <File size={20} className="text-gradient" />
              <span className="file-name" title={file.name}>{file.name}</span>
              <span className="file-size text-muted">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            {onRemove && (
              <button 
                onClick={() => onRemove(index)} 
                className="btn-icon danger"
                title="Remove file"
              >
                <Trash2 size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FilePreviewList;
