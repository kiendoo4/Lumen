import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import Header from './Header';
import Sidebar from './Sidebar';
import DialogSettingsModal from './DialogSettingsModal';
import CreateConversationModal from './CreateConversationModal';
import ConversationSettingsModal from './ConversationSettingsModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import DialogSearchModal from './DialogSearchModal';
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
  const [isDialogSearchOpen, setIsDialogSearchOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, type: null, id: null, name: null, conversationId: null });
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
    // Set selected conversation and dialog to open the newly created dialog
    setSelectedConversationId(conversation.id);
    setSelectedDialogId(dialog.id);
    setMessages([]);
    setIsCreateConversationModalOpen(false);
    // loadDialogData will be called automatically via useEffect when selectedDialogId changes
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

  const handleDeleteConversation = (conversationId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    setDeleteConfirmation({
      isOpen: true,
      type: 'conversation',
      id: conversationId,
      name: conversation?.title || '',
      conversationId: null
    });
  };

  const handleDeleteDialog = (conversationId, dialogId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    const dialog = conversation?.dialogs?.find(d => d.id === dialogId);
    setDeleteConfirmation({
      isOpen: true,
      type: 'dialog',
      id: dialogId,
      name: dialog?.title || '',
      conversationId: conversationId
    });
  };

  const confirmDelete = async () => {
    try {
      if (deleteConfirmation.type === 'conversation') {
        await axios.delete(`/api/conversations/${deleteConfirmation.id}`);
        await loadConversations();
        if (selectedConversationId === deleteConfirmation.id) {
          const remaining = (conversations || []).filter(c => c.id !== deleteConfirmation.id);
          if (remaining.length > 0) {
            handleSelectConversation(remaining[0].id);
          } else {
            setSelectedConversationId(null);
            setSelectedDialogId(null);
            setMessages([]);
          }
        }
      } else if (deleteConfirmation.type === 'dialog') {
        await axios.delete(`/api/dialogs/${deleteConfirmation.id}`);
        await loadConversations();
        if (selectedDialogId === deleteConfirmation.id) {
          const conversation = (conversations || []).find(c => c.id === deleteConfirmation.conversationId);
          if (conversation && conversation.dialogs && conversation.dialogs.length > 1) {
            const otherDialog = conversation.dialogs.find(d => d.id !== deleteConfirmation.id);
            if (otherDialog) {
              handleSelectDialog(deleteConfirmation.conversationId, otherDialog.id);
            }
          } else {
            setSelectedDialogId(null);
            setMessages([]);
          }
        }
      }
      setDeleteConfirmation({ isOpen: false, type: null, id: null, name: null, conversationId: null });
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleOpenDialogSearch = () => {
    setIsDialogSearchOpen(true);
  };

  const handleSendMessage = async (text, files = []) => {
    if ((!text.trim() && files.length === 0) || isLoading) return;

    if (!selectedConversationId || !selectedDialogId) {
      await handleCreateConversation();
      return;
    }

    // Add user message to UI immediately (not saved to DB yet)
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
      formData.append('dialog_id', selectedDialogId);
      formData.append('context', JSON.stringify(context));
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post('/api/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;

      // Only add agent message if we got a successful response
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
      
      // Set loading to false BEFORE saving messages to prevent "thinking" indicator after response
      setIsLoading(false);
      
      // Only save messages to database AFTER successful response
      try {
        // Save user message first
        const userMessageResponse = await axios.post(`/api/messages/dialog/${selectedDialogId}`, {
          role: 'user',
          content: text
        });
        
        // Save agent message
        const agentMessageResponse = await axios.post(`/api/messages/dialog/${selectedDialogId}`, {
          role: 'agent',
          content: data.message || '',
          reasoning: data.reasoning || null,
          confidence: data.confidence || null,
          sources: data.sources || null
        });
        
        // Update messages with real IDs from database
        setMessages(prev => {
          const updated = [...prev];
          // Update user message (second to last)
          if (updated.length >= 2) {
            updated[updated.length - 2] = {
              ...updated[updated.length - 2],
              id: userMessageResponse.data.id,
              timestamp: new Date(userMessageResponse.data.created_at)
            };
          }
          // Update agent message (last)
          if (updated.length >= 1) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              id: agentMessageResponse.data.id,
              timestamp: new Date(agentMessageResponse.data.created_at)
            };
          }
          return updated;
        });
        
        // Auto-name dialog after first message exchange (exactly 2 messages: user + agent)
        // Check if this was the first exchange by checking message count before we added these 2 messages
        const messageCountBeforeSave = messages.length;
        if (messageCountBeforeSave === 0) {
          // This is the first exchange, auto-name the dialog (async, don't wait)
          axios.post(`/api/dialogs/${selectedDialogId}/auto-name`)
            .then(autoNameResponse => {
              // Update dialog in conversations list
              setConversations(prev => prev.map(conv => {
                if (conv.id === selectedConversationId) {
                  return {
                    ...conv,
                    dialogs: conv.dialogs.map(d => 
                      d.id === selectedDialogId 
                        ? { ...d, title: autoNameResponse.data.title }
                        : d
                    )
                  };
                }
                return conv;
              }));
              // Update selected dialog
              if (selectedDialog) {
                setSelectedDialog(prev => ({ ...prev, title: autoNameResponse.data.title }));
              }
            })
            .catch(error => {
              console.error('Error auto-naming dialog:', error);
              // Don't fail the whole operation if auto-naming fails
            });
        }
      } catch (error) {
        console.error('Error saving messages:', error);
        console.error('Error details:', error.response?.data);
        // Don't remove messages from UI even if save fails
        // They will be lost on reload but at least user can see them now
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      // Remove user message from UI if request failed (since it wasn't saved)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: t('chat.error'),
        isError: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(`/api/messages/${messageId}`);
      // Remove message and all subsequent messages (agent response)
      setMessages(prev => {
        const index = prev.findIndex(m => m.id === messageId);
        if (index !== -1) {
          // Remove the user message and all messages after it (including agent response)
          return prev.slice(0, index);
        }
        return prev;
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleRedoMessage = async (messageId) => {
    // Find the message to redo
    const messageToRedo = messages.find(m => m.id === messageId);
    if (!messageToRedo || messageToRedo.role !== 'user') return;

    // Delete the message and its response
    await handleDeleteMessage(messageId);
    
    // Resend the message
    setTimeout(() => {
      handleSendMessage(messageToRedo.content, messageToRedo.files || []);
    }, 100);
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
          onDeleteConversation={handleDeleteConversation}
          onDeleteDialog={handleDeleteDialog}
          onOpenConversationSettings={handleOpenConversationSettings}
          onOpenDialogSearch={handleOpenDialogSearch}
        />
        <div className="chat-main">
          <MessageList 
            messages={messages} 
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
            onDeleteMessage={handleDeleteMessage}
            onRedoMessage={handleRedoMessage}
          />
          {selectedDialogId && (
            <InputArea 
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              isModalOpen={isCreateConversationModalOpen || isConversationSettingsOpen || isDialogSearchOpen || deleteConfirmation.isOpen}
            />
          )}
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
      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, type: null, id: null, name: null, conversationId: null })}
        onConfirm={confirmDelete}
        type={deleteConfirmation.type}
        name={deleteConfirmation.name}
      />
      <DialogSearchModal
        isOpen={isDialogSearchOpen}
        onClose={() => setIsDialogSearchOpen(false)}
        conversations={conversations}
        onSelectDialog={handleSelectDialog}
      />
    </div>
  );
}

export default ChatInterface;
