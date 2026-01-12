import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './DocumentUpload.css';

const DocumentUpload = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  const allowedExtensions = ['.pdf', '.docx', '.txt'];

  const validateFile = (file) => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return 'Unsupported file type. Only PDF, DOCX, and TXT files are allowed.';
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return 'File too large. Maximum size is 50MB.';
    }

    return null;
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/paper-chat/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  };

  const handleFileUpload = async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const result = await uploadFile(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        // Navigate to processing page
        navigate(`/paper-chat/processing/${result.document_id}`);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      setError(error.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="document-upload-page">
      <div className="document-upload-container">
        <div className="document-upload-header">
          <button 
            className="back-button"
            onClick={() => navigate('/paper-chat')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back to Library
          </button>
          <h1>Upload Document</h1>
          <p>Upload a research paper to start chatting with it</p>
        </div>

        <div className="document-upload-content">
          {!uploading ? (
            <div
              className={`upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleBrowseClick}
            >
              <div className="upload-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              
              <div className="upload-text">
                <h3>Drop your document here</h3>
                <p>or <span className="upload-browse-text">browse files</span></p>
              </div>
              
              <div className="upload-info">
                <p>Supported formats: PDF, DOCX, TXT</p>
                <p>Maximum size: 50MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={allowedExtensions.join(',')}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="upload-progress-container">
              <div className="upload-progress-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              
              <h3>Uploading document...</h3>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              
              <p>{uploadProgress}% complete</p>
            </div>
          )}

          {error && (
            <div className="upload-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
