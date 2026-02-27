import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './DocumentProcessing.css';

const DocumentProcessing = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [documentInfo, setDocumentInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!documentId) {
      navigate('/paper-chat/upload');
      return;
    }

    // Poll for status updates
    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/paper-chat/documents/${documentId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document status');
        }

        const data = await response.json();
        setStatus(data.processing_status);
        setDocumentInfo(data);

        if (data.processing_status === 'completed') {
          // Wait a moment then navigate to chat
          setTimeout(() => {
            navigate(`/paper-chat/document/${documentId}`);
          }, 1500);
        } else if (data.processing_status === 'failed') {
          setError('Document processing failed. Please try uploading again.');
        }
      } catch (err) {
        setError(err.message);
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval (stop when done/failed)
    const interval = setInterval(() => {
      // don't keep polling if we've hit a terminal state
      if (status === 'completed' || status === 'failed' || error) return;
      pollStatus();
    }, 2000);

    // Cleanup
    return () => clearInterval(interval);
  }, [documentId, navigate, status, error]);

  const getStatusMessage = () => {
    switch (status) {
      case 'pending':
        return 'Preparing document for processing...';
      case 'processing':
        return 'Analyzing document and creating embeddings...';
      case 'completed':
        return 'Document processed successfully!';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Processing document...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22,4 12,14.01 9,11.01"></polyline>
          </svg>
        );
      case 'failed':
        return (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
      default:
        return (
          <div className="processing-spinner">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
        );
    }
  };

  if (error) {
    return (
      <div className="document-processing-page">
        <div className="document-processing-container">
          <div className="processing-content error">
            <div className="processing-icon error">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2>Processing Error</h2>
            <p>{error}</p>
            <div className="processing-actions">
              <button 
                className="btn-secondary"
                onClick={() => navigate('/paper-chat/upload')}
              >
                Upload Another Document
              </button>
              <button 
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-processing-page">
      <div className="document-processing-container">
        <div className="processing-header">
          <button 
            className="back-button"
            onClick={() => navigate('/paper-chat/upload')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back to Upload
          </button>
        </div>

        <div className="processing-content">
          <div className={`processing-icon ${status}`}>
            {getStatusIcon()}
          </div>

          <h2>{getStatusMessage()}</h2>

          {documentInfo && (
            <div className="document-info">
              <h3>{documentInfo.file_name || documentInfo.title}</h3>
            </div>
          )}

          {/* We intentionally do not show numeric percentages; just show current stage */}

          <div className="processing-steps">
            <div className="step completed">
              <div className="step-icon">
                {(
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                )}
              </div>
              <span>Document uploaded</span>
            </div>

            <div className={`step ${status === 'completed' ? 'completed' : (status === 'pending' || status === 'processing') ? 'active' : ''}`}>
              <div className="step-icon">
                {status === 'completed' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                ) : (status === 'pending' || status === 'processing') ? (
                  <div className="step-spinner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  </div>
                ) : (
                  <div className="step-number">2</div>
                )}
              </div>
              <span>Processing text and creating embeddings</span>
            </div>

            <div className={`step ${status === 'completed' ? 'active' : ''}`}>
              <div className="step-icon">
                {status === 'completed' ? (
                  <div className="step-spinner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  </div>
                ) : (
                  <div className="step-number">3</div>
                )}
              </div>
              <span>Ready for chat</span>
            </div>
          </div>

          {status === 'completed' && (
            <div className="completion-message">
              <p>Your document is ready! Redirecting to chat...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentProcessing;
