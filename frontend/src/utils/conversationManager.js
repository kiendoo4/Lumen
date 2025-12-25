class ConversationManager {
  constructor() {
    this.conversations = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('conversations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveToStorage() {
    localStorage.setItem('conversations', JSON.stringify(this.conversations));
  }

  createConversation(title = 'New Conversation') {
    const conversation = {
      id: Date.now(),
      title,
      dialogs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.conversations.push(conversation);
    this.saveToStorage();
    return conversation;
  }

  createDialog(conversationId, title = 'New Dialog') {
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) return null;

    const dialog = {
      id: Date.now(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    conversation.dialogs.push(dialog);
    conversation.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return dialog;
  }

  getConversation(id) {
    return this.conversations.find(c => c.id === id);
  }

  getDialog(conversationId, dialogId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;
    return conversation.dialogs.find(d => d.id === dialogId);
  }

  addMessage(conversationId, dialogId, message) {
    const dialog = this.getDialog(conversationId, dialogId);
    if (!dialog) return false;

    dialog.messages.push(message);
    dialog.updatedAt = new Date().toISOString();
    
    const conversation = this.getConversation(conversationId);
    if (conversation) {
      conversation.updatedAt = new Date().toISOString();
    }

    this.saveToStorage();
    return true;
  }

  updateConversationTitle(id, title) {
    const conversation = this.getConversation(id);
    if (!conversation) return false;
    conversation.title = title;
    conversation.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  updateDialogTitle(conversationId, dialogId, title) {
    const dialog = this.getDialog(conversationId, dialogId);
    if (!dialog) return false;
    dialog.title = title;
    dialog.updatedAt = new Date().toISOString();
    
    const conversation = this.getConversation(conversationId);
    if (conversation) {
      conversation.updatedAt = new Date().toISOString();
    }

    this.saveToStorage();
    return true;
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.saveToStorage();
    return true;
  }

  deleteDialog(conversationId, dialogId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return false;
    conversation.dialogs = conversation.dialogs.filter(d => d.id !== dialogId);
    conversation.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  searchConversations(query) {
    const lowerQuery = query.toLowerCase();
    return this.conversations.filter(c => 
      c.title.toLowerCase().includes(lowerQuery) ||
      c.dialogs.some(d => 
        d.title.toLowerCase().includes(lowerQuery) ||
        d.messages.some(m => m.content.toLowerCase().includes(lowerQuery))
      )
    );
  }

  getAllConversations() {
    return [...this.conversations].sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }
}

export default ConversationManager;

