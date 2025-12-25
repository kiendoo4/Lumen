export const translations = {
  en: {
    // Header
    'app.title': 'Research Agent',
    'app.subtitle': 'Conversational Research Assistant with Structured Reasoning',
    
    // Sidebar
    'sidebar.conversations': 'Conversations',
    'sidebar.dialogs': 'Dialogs',
    'sidebar.newConversation': 'New Conversation',
    'sidebar.newDialog': 'New Dialog',
    'sidebar.search': 'Search',
    'sidebar.searchPlaceholder': 'Search conversations...',
    'sidebar.noConversations': 'No conversations yet',
    'sidebar.noDialogs': 'No dialogs yet',
    'sidebar.settings': 'Settings',
    
    // Context Panel
    'context.title': 'Research Context',
    'context.sources': 'Sources',
    'context.papers': 'Papers in Session',
    'context.noPapers': 'No papers added yet',
    'context.addPaper': 'Add Paper',
    'context.dropFiles': 'Drop files here or click to upload',
    'context.orClick': 'PDF, DOC, TXT files supported',
    'context.addMore': 'Add more sources',
    'context.remove': 'Remove',
    'context.doi': 'DOI',
    'context.arxiv': 'arXiv ID',
    'context.url': 'URL',
    'context.enter': 'Enter',
    'context.add': 'Add',
    'context.cancel': 'Cancel',
    
    // Chat
    'chat.placeholder': 'Ask a research question...',
    'chat.hint': 'Press Enter to send, Shift+Enter for new line',
    'chat.empty.title': 'Welcome to Research Agent',
    'chat.empty.description': 'Ask questions about research papers, analyze methodologies, or compare findings.',
    'chat.empty.examples': 'Example questions:',
    'chat.loading': 'Research Agent is thinking...',
    'chat.error': 'Sorry, there was an error processing your request.',
    
    // Message
    'message.you': 'You',
    'message.agent': 'Research Agent',
    'message.reasoning': 'Reasoning Steps:',
    'message.confidence': 'Confidence:',
    'message.sources': 'Sources:',
    
    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    
    // Language
    'language.en': 'English',
    'language.vi': 'Tiếng Việt',
    
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.loginSubtitle': 'Welcome back! Please login to continue.',
    'auth.registerSubtitle': 'Create your account to get started.',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.usernamePlaceholder': 'Enter your username',
    'auth.emailPlaceholder': 'Enter your email',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.confirmPasswordPlaceholder': 'Confirm your password',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.loading': 'Loading...',
    'auth.passwordMismatch': 'Passwords do not match',
    'auth.passwordTooShort': 'Password must be at least 6 characters',
    'auth.or': 'or',
    
    // Settings Modal
    'settings.title': 'Dialog Settings',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.llm.title': 'LLM Model',
    'settings.llm.model': 'Model',
    'settings.advanced.title': 'Advanced Parameters',
    'settings.advanced.description': 'Fine-tune the model behavior for this dialog',
    'settings.advanced.freedom': 'Freedom',
    'settings.advanced.temperature': 'Temperature',
    'settings.advanced.topP': 'Top P',
    'settings.advanced.presencePenalty': 'Presence Penalty',
    'settings.advanced.frequencyPenalty': 'Frequency Penalty',
    'settings.advanced.maxTokens': 'Max Tokens',
    'settings.context.title': 'Research Context',
    'settings.context.description': 'Add sources (PDFs, documents) to provide context for RAG',
    'settings.context.dropFiles': 'Drop files here or click to upload',
    'settings.context.supportedFormats': 'PDF, DOC, DOCX, TXT, MD files supported',
    'settings.context.addMore': 'Add more sources',
    'settings.context.remove': 'Remove',
    
    // Conversation Settings
    'conversationSettings.title': 'Conversation Settings',
    'conversationSettings.changeAvatar': 'Change Avatar',
    
    // Settings Modal
    'settings.llm.provider': 'Provider',
  },
  vi: {
    // Header
    'app.title': 'Research Agent',
    'app.subtitle': 'Trợ lý Nghiên cứu Hội thoại với Suy luận Có cấu trúc',
    
    // Sidebar
    'sidebar.conversations': 'Cuộc trò chuyện',
    'sidebar.dialogs': 'Hội thoại',
    'sidebar.newConversation': 'Cuộc trò chuyện mới',
    'sidebar.newDialog': 'Hội thoại mới',
    'sidebar.search': 'Tìm kiếm',
    'sidebar.searchPlaceholder': 'Tìm kiếm cuộc trò chuyện...',
    'sidebar.noConversations': 'Chưa có cuộc trò chuyện nào',
    'sidebar.noDialogs': 'Chưa có hội thoại nào',
    'sidebar.settings': 'Cài đặt',
    
    // Context Panel
    'context.title': 'Ngữ cảnh Nghiên cứu',
    'context.sources': 'Nguồn',
    'context.papers': 'Papers trong Phiên',
    'context.noPapers': 'Chưa thêm paper nào',
    'context.addPaper': 'Thêm Paper',
    'context.dropFiles': 'Kéo thả file vào đây hoặc click để upload',
    'context.orClick': 'Hỗ trợ file PDF, DOC, TXT',
    'context.addMore': 'Thêm nguồn khác',
    'context.remove': 'Xóa',
    'context.doi': 'DOI',
    'context.arxiv': 'arXiv ID',
    'context.url': 'URL',
    'context.enter': 'Nhập',
    'context.add': 'Thêm',
    'context.cancel': 'Hủy',
    
    // Chat
    'chat.placeholder': 'Đặt câu hỏi nghiên cứu...',
    'chat.hint': 'Nhấn Enter để gửi, Shift+Enter để xuống dòng',
    'chat.empty.title': 'Chào mừng đến Research Agent',
    'chat.empty.description': 'Đặt câu hỏi về research papers, phân tích phương pháp, hoặc so sánh kết quả.',
    'chat.empty.examples': 'Câu hỏi ví dụ:',
    'chat.loading': 'Research Agent đang suy nghĩ...',
    'chat.error': 'Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn.',
    
    // Message
    'message.you': 'Bạn',
    'message.agent': 'Research Agent',
    'message.reasoning': 'Các bước Suy luận:',
    'message.confidence': 'Độ tin cậy:',
    'message.sources': 'Nguồn:',
    
    // Theme
    'theme.light': 'Sáng',
    'theme.dark': 'Tối',
    
    // Language
    'language.en': 'English',
    'language.vi': 'Tiếng Việt',
    
    // Auth
    'auth.login': 'Đăng nhập',
    'auth.register': 'Đăng ký',
    'auth.loginSubtitle': 'Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.',
    'auth.registerSubtitle': 'Tạo tài khoản để bắt đầu.',
    'auth.username': 'Tên đăng nhập',
    'auth.email': 'Email',
    'auth.password': 'Mật khẩu',
    'auth.confirmPassword': 'Xác nhận mật khẩu',
    'auth.usernamePlaceholder': 'Nhập tên đăng nhập',
    'auth.emailPlaceholder': 'Nhập email',
    'auth.passwordPlaceholder': 'Nhập mật khẩu',
    'auth.confirmPasswordPlaceholder': 'Xác nhận mật khẩu',
    'auth.noAccount': 'Chưa có tài khoản?',
    'auth.hasAccount': 'Đã có tài khoản?',
    'auth.loading': 'Đang tải...',
    'auth.passwordMismatch': 'Mật khẩu không khớp',
    'auth.passwordTooShort': 'Mật khẩu phải có ít nhất 6 ký tự',
    'auth.or': 'hoặc',
    
    // Settings Modal
    'settings.title': 'Cài đặt Hội thoại',
    'settings.save': 'Lưu',
    'settings.cancel': 'Hủy',
    'settings.llm.title': 'Mô hình LLM',
    'settings.llm.model': 'Mô hình',
    'settings.advanced.title': 'Tham số Nâng cao',
    'settings.advanced.description': 'Tinh chỉnh hành vi mô hình cho hội thoại này',
    'settings.advanced.freedom': 'Tự do',
    'settings.advanced.temperature': 'Nhiệt độ',
    'settings.advanced.topP': 'Top P',
    'settings.advanced.presencePenalty': 'Phạt Hiện diện',
    'settings.advanced.frequencyPenalty': 'Phạt Tần suất',
    'settings.advanced.maxTokens': 'Số Token Tối đa',
    'settings.context.title': 'Ngữ cảnh Nghiên cứu',
    'settings.context.description': 'Thêm nguồn (PDF, tài liệu) để cung cấp ngữ cảnh cho RAG',
    'settings.context.dropFiles': 'Kéo thả file vào đây hoặc click để upload',
    'settings.context.supportedFormats': 'Hỗ trợ file PDF, DOC, DOCX, TXT, MD',
    'settings.context.addMore': 'Thêm nguồn khác',
    'settings.context.remove': 'Xóa',
    
    // Conversation Settings
    'conversationSettings.title': 'Cài đặt Cuộc trò chuyện',
    'conversationSettings.changeAvatar': 'Đổi Ảnh đại diện',
    
    // Settings Modal
    'settings.llm.provider': 'Nhà cung cấp',
  }
};

