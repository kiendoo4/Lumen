import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import Header from './Header';
import Sidebar from './Sidebar';
import DialogSettingsModal from './DialogSettingsModal';
import CreateConversationModal from './CreateConversationModal';
import ConversationSettingsModal from './ConversationSettingsModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './ChatInterface.css';

function ChatInterface({ onProfileClick }) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedDialogId, setSelectedDialogId] = useState(null);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogSettingsOpen, setIsDialogSettingsOpen] = useState(false);
  const [isConversationSettingsOpen, setIsConversationSettingsOpen] = useState(false);
  const [selectedConversationForSettings, setSelectedConversationForSettings] = useState(null);
  const [context, setContext] = useState({
    papers: []
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedDialogId && conversations && conversations.length > 0) {
      loadDialogData();
    }
  }, [selectedDialogId, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await axios.get('/api/conversations/');
      // Backend returns array directly, not wrapped in object
      const conversationsList = Array.isArray(response.data) ? response.data : (response.data?.conversations || []);
      setConversations(conversationsList);
      
      if (conversationsList.length > 0 && !selectedConversationId) {
        const firstConv = conversationsList[0];
        setSelectedConversationId(firstConv.id);
        if (firstConv.dialogs && firstConv.dialogs.length > 0) {
          setSelectedDialogId(firstConv.dialogs[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    }
  };

  const loadDialogData = async () => {
    if (!selectedDialogId || !selectedConversationId || !conversations) return;
    
    try {
      // Get dialog from conversation's dialogs list
      const conversation = conversations.find(c => c.id === selectedConversationId);
      
      if (conversation && conversation.dialogs) {
        const dialog = conversation.dialogs.find(d => d.id === selectedDialogId);
        if (dialog) {
          setSelectedDialog(dialog);
          
          // Load sources
          if (dialog.sources) {
            setContext({ papers: dialog.sources.map(s => ({
              id: s.id,
              type: s.source_type,
              value: s.source_value || s.file_name
            })) });
          } else {
            setContext({ papers: [] });
          }
          
          // Load messages
          try {
            const messagesResponse = await axios.get(`/api/messages/dialog/${selectedDialogId}`);
            const messagesData = messagesResponse.data || [];
            setMessages(messagesData.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              reasoning: m.reasoning,
              confidence: m.confidence,
              sources: m.sources,
              timestamp: new Date(m.created_at)
            })));
          } catch (error) {
            console.error('Error loading messages:', error);
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading dialog:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);

  const handleCreateConversation = () => {
    setIsCreateConversationModalOpen(true);
  };

  const handleConversationCreated = async (data) => {
    const { conversation, dialog } = data;
    await loadConversations();
    setSelectedConversationId(conversation.id);
    setSelectedDialogId(dialog.id);
    setMessages([]);
    setIsCreateConversationModalOpen(false);
  };

  const handleCreateDialog = async (conversationId) => {
    try {
      const response = await axios.post(`/api/dialogs/conversation/${conversationId}`, {
        title: 'New Dialog'
      });
      await loadConversations();
      setSelectedConversationId(conversationId);
      // Backend returns DialogResponse directly
      setSelectedDialogId(response.data.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating dialog:', error);
    }
  };

  const handleOpenConversationSettings = (conversationId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    setSelectedConversationForSettings(conversation);
    setIsConversationSettingsOpen(true);
  };

  const handleConversationUpdate = (updatedConversation) => {
    setConversations(prev => prev.map(c => 
      c.id === updatedConversation.id ? { ...c, ...updatedConversation } : c
    ));
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
    const conversation = (conversations || []).find(c => c.id === conversationId);
    if (conversation && conversation.dialogs && conversation.dialogs.length > 0) {
      setSelectedDialogId(conversation.dialogs[0].id);
    } else {
      setSelectedDialogId(null);
      setMessages([]);
    }
  };

  const handleSelectDialog = (conversationId, dialogId) => {
    setSelectedConversationId(conversationId);
    setSelectedDialogId(dialogId);
  };

  const handleDeleteConversation = async (conversationId) => {
    if (window.confirm(t('sidebar.conversations') + ' will be deleted')) {
      try {
        await axios.delete(`/api/conversations/${conversationId}`);
        await loadConversations();
        if (selectedConversationId === conversationId) {
          const remaining = (conversations || []).filter(c => c.id !== conversationId);
          if (remaining.length > 0) {
            handleSelectConversation(remaining[0].id);
          } else {
            setSelectedConversationId(null);
            setSelectedDialogId(null);
            setMessages([]);
          }
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
  };

  const handleDeleteDialog = async (conversationId, dialogId) => {
    if (window.confirm(t('sidebar.dialogs') + ' will be deleted')) {
      // TODO: Implement delete dialog API
      await loadConversations();
      if (selectedDialogId === dialogId) {
        const conversation = (conversations || []).find(c => c.id === conversationId);
        if (conversation && conversation.dialogs && conversation.dialogs.length > 1) {
          const otherDialog = conversation.dialogs.find(d => d.id !== dialogId);
          if (otherDialog) {
            handleSelectDialog(conversationId, otherDialog.id);
          }
        } else {
          setSelectedDialogId(null);
          setMessages([]);
        }
      }
    }
  };

  const handleSearch = (query) => {
    if (query.trim() && conversations) {
      const filtered = conversations.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.dialogs && c.dialogs.some(d => d.title.toLowerCase().includes(query.toLowerCase())))
      );
      setConversations(filtered);
    } else {
      loadConversations();
    }
  };

  const handleSendMessage = async (text, files = []) => {
    if ((!text.trim() && files.length === 0) || isLoading) return;

    if (!selectedConversationId || !selectedDialogId) {
      await handleCreateConversation();
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      files: files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      })),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', text);
      formData.append('context', JSON.stringify(context));
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post('/api/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;

      const agentMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: data.message || t('chat.error'),
        reasoning: data.reasoning || [],
        confidence: data.confidence,
        sources: data.sources || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);
      
      // Save messages to backend
      try {
        await axios.post(`/api/messages/dialog/${selectedDialogId}`, {
          role: 'user',
          content: text
        });
        await axios.post(`/api/messages/dialog/${selectedDialogId}`, {
          role: 'agent',
          content: data.message,
          reasoning: data.reasoning,
          confidence: data.confidence,
          sources: data.sources
        });
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: t('chat.error'),
        isError: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContext = async (type, data) => {
    if (type === 'paper' && selectedDialogId) {
      try {
        const formData = new FormData();
        if (data.file) {
          formData.append('files', data.file);
        } else {
          formData.append('source_type', data.type || 'file');
          formData.append('source_value', data.value);
        }

        const response = await axios.post(`/api/dialogs/${selectedDialogId}/sources`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setContext(prev => ({
          ...prev,
          papers: [...prev.papers, ...response.data.sources.map(s => ({
            id: s.id,
            type: s.source_type,
            value: s.source_value || s.file_name
          }))]
        }));
      } catch (error) {
        console.error('Error adding source:', error);
      }
    } else if (type === 'remove' && selectedDialogId) {
      try {
        await axios.delete(`/api/dialogs/${selectedDialogId}/sources/${data.id}`);
        setContext(prev => ({
          ...prev,
          papers: prev.papers.filter(p => p.id !== data.id)
        }));
      } catch (error) {
        console.error('Error removing source:', error);
      }
    }
  };

  const handleOpenDialogSettings = () => {
    if (selectedDialogId) {
      setIsDialogSettingsOpen(true);
    }
  };

  const handleCloseDialogSettings = () => {
    setIsDialogSettingsOpen(false);
  };

  const handleSaveDialogSettings = async (newSettings) => {
    if (!selectedDialogId) return;

    try {
      await axios.put(`/api/dialogs/${selectedDialogId}`, {
        llm_model: newSettings.llm,
        freedom: newSettings.freedom,
        temperature: newSettings.temperature,
        top_p: newSettings.topP,
        presence_penalty: newSettings.presencePenalty,
        frequency_penalty: newSettings.frequencyPenalty,
        max_tokens: newSettings.maxTokens
      });
      
      await loadDialogData();
      setIsDialogSettingsOpen(false);
    } catch (error) {
      console.error('Error saving dialog settings:', error);
    }
  };


  return (
    <div className="chat-interface">
      <Header onProfileClick={onProfileClick} />
      <div className="chat-container">
        <Sidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          selectedDialogId={selectedDialogId}
          onSelectConversation={handleSelectConversation}
          onSelectDialog={handleSelectDialog}
          onCreateConversation={handleCreateConversation}
          onCreateDialog={handleCreateDialog}
          onSearch={handleSearch}
          onDeleteConversation={handleDeleteConversation}
          onDeleteDialog={handleDeleteDialog}
          onOpenConversationSettings={handleOpenConversationSettings}
        />
        <div className="chat-main">
          <MessageList 
            messages={messages} 
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
          <InputArea 
            onSendMessage={handleSendMessage}
            disabled={isLoading}
          />
        </div>
      </div>
      <DialogSettingsModal
        isOpen={isDialogSettingsOpen}
        onClose={handleCloseDialogSettings}
        settings={selectedDialog ? {
          llm: selectedDialog.llm_model,
          freedom: parseFloat(selectedDialog.freedom),
          temperature: parseFloat(selectedDialog.temperature),
          topP: parseFloat(selectedDialog.top_p),
          presencePenalty: parseFloat(selectedDialog.presence_penalty),
          frequencyPenalty: parseFloat(selectedDialog.frequency_penalty),
          maxTokens: selectedDialog.max_tokens
        } : null}
        onSave={handleSaveDialogSettings}
        context={context}
        onAddContext={handleAddContext}
      />
      <CreateConversationModal
        isOpen={isCreateConversationModalOpen}
        onClose={() => setIsCreateConversationModalOpen(false)}
        onCreate={handleConversationCreated}
      />
      <ConversationSettingsModal
        isOpen={isConversationSettingsOpen}
        onClose={() => {
          setIsConversationSettingsOpen(false);
          setSelectedConversationForSettings(null);
        }}
        conversationId={selectedConversationForSettings?.id}
        conversation={selectedConversationForSettings}
        onUpdate={handleConversationUpdate}
      />
    </div>
  );
}

export default ChatInterface;
