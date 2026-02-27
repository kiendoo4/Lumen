import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Tooltip from '../common/Tooltip';
import Settings from '../common/Settings';
import './DocumentLibrary.css';

const DocumentLibrary = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/paper-chat/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/paper-chat/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Remove from local state
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Processing...', class: 'status-pending' },
      processing: { label: 'Processing...', class: 'status-processing' },
      completed: { label: 'Ready', class: 'status-completed' },
      failed: { label: 'Failed', class: 'status-failed' }
    };

    const config = statusConfig[status] || { label: status, class: 'status-unknown' };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="document-library-loading">
        <div className="loading-spinner">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="document-library-page">
      {/* Enhanced Header */}
      <div className="document-library-header">
        <div className="header-left">
          <Tooltip text="Back to Home" position="bottom">
            <button 
              className="header-back-button"
              onClick={() => navigate('/home')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9,22 9,12 15,12 15,22"></polyline>
              </svg>
            </button>
          </Tooltip>
          
          <div className="header-title-section">
            <div className="page-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div>
              <h1>Document Library</h1>
              <p>Manage your uploaded documents for paper chat</p>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button 
            className="upload-button"
            onClick={() => navigate('/paper-chat/upload')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            Upload New Document
          </button>
          <div className="document-library-header-settings">
            <Settings variant="header" />
          </div>
          {user && (
            <Tooltip text={user.username || 'Profile'} position="bottom">
              <button
                className="header-avatar-button"
                onClick={() => navigate('/settings')}
              >
                <img
                  src={user.avatar_url || '/default_avatar.jpeg'}
                  alt={user.username}
                  className="header-avatar"
                  onError={(e) => {
                    e.target.src = '/default_avatar.jpeg';
                  }}
                />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="document-library-container">

        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="documents-grid">
          {documents.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              <h3>No documents yet</h3>
              <p>Upload your first document to start chatting with papers</p>
              <button 
                className="upload-button-primary"
                onClick={() => navigate('/paper-chat/upload')}
              >
                Upload Document
              </button>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="document-type-indicator">
                    <div className="document-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10,9 9,9 8,9"></polyline>
                      </svg>
                    </div>
                    <div className="file-type-badge">
                      {doc.file_name.split('.').pop().toUpperCase()}
                    </div>
                  </div>
                  {getStatusBadge(doc.processing_status)}
                </div>

                <div className="document-content">
                  <h3 className="document-title" title={doc.file_name || doc.title}>
                    {doc.file_name || doc.title}
                  </h3>
                  
                  {doc.authors && (
                    <p className="document-authors" title={doc.authors}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      {doc.authors}
                    </p>
                  )}
                  
                  {doc.abstract && (
                    <p className="document-abstract" title={doc.abstract}>
                      {doc.abstract.length > 120 
                        ? `${doc.abstract.substring(0, 120)}...` 
                        : doc.abstract
                      }
                    </p>
                  )}

                  <div className="document-meta">
                    <div className="meta-row">
                      <span className="meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14,2 14,8 20,8"></polyline>
                        </svg>
                        {formatFileSize(doc.file_size || 0)}
                      </span>
                      {doc.total_pages && (
                        <span className="meta-item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                          </svg>
                          {doc.total_pages} pages
                        </span>
                      )}
                    </div>
                    <div className="meta-row">
                      <span className="meta-item upload-date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12,6 12,12 16,14"></polyline>
                        </svg>
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="document-actions">
                  {doc.processing_status === 'completed' ? (
                    <button 
                      className="chat-button primary-action"
                      onClick={() => navigate(`/paper-chat/document/${doc.id}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      Chat with Paper
                    </button>
                  ) : doc.processing_status === 'processing' ? (
                    <button 
                      className="processing-button primary-action"
                      onClick={() => navigate(`/paper-chat/processing/${doc.id}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      View Progress
                    </button>
                  ) : doc.processing_status === 'failed' ? (
                    <button 
                      className="retry-button primary-action"
                      onClick={() => window.location.reload()}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6"></path>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                      Retry
                    </button>
                  ) : (
                    <button className="pending-button primary-action" disabled>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12,6 12,12 16,14"></polyline>
                      </svg>
                      Pending
                    </button>
                  )}

                  <button 
                    className="delete-button secondary-action"
                    onClick={() => deleteDocument(doc.id)}
                    title="Delete document"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentLibrary;
