from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
import json
from app.middleware.auth import get_current_user
from app.database import get_db
from app.models import LLMProvider, ProviderEnum, Dialog, Conversation, Message, RoleEnum, User, DialogSource, SourceTypeEnum
from app.utils.litellm_client import get_llm_config
from app.agent.call_llm import call_lumen_agent
from sqlalchemy.orm import Session


router = APIRouter()


def _choose_default_model(db, user_id: int) -> str:
    """
    Pick a default chat model based on configured providers for the user.

    Priority:
      1. OpenAI (gpt-4o-mini)
      2. Gemini (gemini-2.5-flash)
      3. Ollama (llama3)
      4. Fallback: gpt-4o-mini (env-based)
    """
    # Check which providers user has configured
    providers = (
        db.query(LLMProvider)
        .filter(LLMProvider.user_id == user_id)
        .all()
    )
    provider_set = {p.provider for p in providers}

    if ProviderEnum.openai in provider_set:
        return "gpt-4o-mini"
    if ProviderEnum.gemini in provider_set:
        return "gemini-2.5-flash"
    if ProviderEnum.groq in provider_set:
        return "groq/llama-3.1-8b-instant"
    if ProviderEnum.ollama in provider_set:
        return "llama3"

    # Fallback – will rely on env OPENAI_API_KEY
    return "gpt-4o-mini"


@router.post("")
async def chat(
    message: str = Form(...),
    dialog_id: Optional[int] = Form(None),
    context: Optional[str] = Form(None),
    timezone: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simple QA chat endpoint using LiteLLM.

    - Uses per-user LLM provider configuration (OpenAI/Gemini/Ollama)
    - Basic QA-style system prompt for research assistant use case
    - Includes chat history if dialog_id is provided
    """
    user_id = current_user["userId"]

    # If dialog_id is provided, verify ownership and get dialog settings
    dialog = None
    model = None
    generation_settings = {
        "temperature": 0.7,
        "top_p": 0.9,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
        "max_tokens": 4000,
        "openai_api_key": None,
        "gemini_api_key": None,
    }

    if dialog_id:
        # Verify ownership - join Dialog with Conversation through foreign key
        dialog = db.query(Dialog).join(
            Conversation, Dialog.conversation_id == Conversation.id
        ).filter(
            Dialog.id == dialog_id,
            Conversation.user_id == user_id
        ).first()
        
        if not dialog:
            raise HTTPException(
                status_code=404,
                detail="Dialog not found"
            )
        
        # Get conversation for config (config belongs to conversation, not dialog)
        conversation = db.query(Conversation).filter(Conversation.id == dialog.conversation_id).first()
        
        # Use conversation's model and settings
        model = conversation.llm_model
        generation_settings = {
            "temperature": float(conversation.temperature),
            "top_p": float(conversation.top_p),
            "presence_penalty": float(conversation.presence_penalty),
            "frequency_penalty": float(conversation.frequency_penalty),
            "max_tokens": conversation.max_tokens,
            "openai_api_key": None,
            "gemini_api_key": None,
        }
    else:
        # Choose a default model based on provider config
        model = _choose_default_model(db, user_id)

    # Build basic QA system prompt
    system_prompt = (
        "You are a helpful research assistant. "
        "Answer the user's question clearly and concisely. "
        "If you are not sure, say you are not sure."
    )
    
    # Load URL contents from DialogSource if dialog_id exists
    url_contents_context = ""
    url_citations_map = {}  # Map URL to citation index for merging
    if dialog_id:
        url_sources = db.query(DialogSource).filter(
            DialogSource.dialog_id == dialog_id,
            DialogSource.source_type == SourceTypeEnum.url,
            DialogSource.content.isnot(None)
        ).order_by(DialogSource.created_at.asc()).all()
        
        if url_sources:
            url_contents_context = "\n\n[Previously accessed URLs in this conversation (you can reference these when answering questions):]\n"
            for i, source in enumerate(url_sources, 1):
                url_contents_context += f"[{i}] {source.file_name or source.source_value}\n"
                url_contents_context += f"    URL: {source.source_value}\n"
                if source.content:
                    # Include a preview of the content (first 500 chars)
                    content_preview = source.content[:500] + "..." if len(source.content) > 500 else source.content
                    url_contents_context += f"    Content preview: {content_preview}\n"
                # Store mapping for citation merging
                url_citations_map[source.source_value] = {
                    'index': i,
                    'title': source.file_name or source.source_value,
                    'url': source.source_value,
                    'type': source.file_type or 'url'
                }
            url_contents_context += "\nCRITICAL: When referencing information from these URLs in your response, you MUST use citation format [1], [2], etc. based on the index above.\n"
            url_contents_context += "For example, if you use information from the first URL, add [1] at the end of that statement. If you use information from the second URL, add [2], etc.\n"
            url_contents_context += "The full content of these URLs is available in the conversation context.\n"
            url_contents_context += "ALWAYS include citations when using information from previously accessed URLs - this is mandatory for proper attribution.\n"

    # Optionally include a short description of context in the prompt
    context_snippet = ""
    if context:
        try:
            parsed = json.loads(context)
            # Very light summarization: mention number of papers attached
            papers = parsed.get("papers") or []
            if isinstance(papers, list) and len(papers) > 0:
                context_snippet = (
                    f"User has attached {len(papers)} context items (papers/files). "
                    "Use them conceptually if relevant, but you cannot read their full contents here. "
                )
        except Exception:
            # Ignore invalid context JSON
            pass

    # Build messages array with chat history if dialog_id is provided
    messages = [{"role": "system", "content": system_prompt + url_contents_context}]
    
    # Add chat history if dialog exists
    if dialog_id and dialog:
        # Get all messages for this dialog, ordered by creation time
        chat_messages = db.query(Message).filter(
            Message.dialog_id == dialog_id
        ).order_by(Message.created_at.asc()).all()
        
        # Add historical messages to the context
        for msg in chat_messages:
            message_content = msg.content or ""
            
            # Include citations in the message content for context (especially for agent messages)
            # This helps LLM understand which papers were mentioned in previous messages
            # Format citations as a readable reference list that LLM can understand
            if msg.citations and isinstance(msg.citations, list) and len(msg.citations) > 0:
                # Only add citations context if not already present in content
                # Check if content already has citation metadata or references section
                has_citation_context = (
                    "[References" in message_content or 
                    "[CITATION_METADATA]" in message_content or
                    "References from this message" in message_content
                )
                
                if not has_citation_context:
                    citations_text = "\n\n[References mentioned in this response:]\n"
                    for i, citation in enumerate(msg.citations, 1):
                        citation_index = citation.get('index', i)
                        title = citation.get('title', 'Untitled')
                        authors = citation.get('authors', [])
                        year = citation.get('year')
                        venue = citation.get('venue', '')
                        paper_id = citation.get('paperId', '')
                        
                        # Format: [1] Title by Author1, Author2 (Year) - Venue
                        citations_text += f"[{citation_index}] {title}"
                        if authors and len(authors) > 0:
                            author_list = ', '.join(authors[:2])
                            if len(authors) > 2:
                                author_list += f" et al."
                            citations_text += f" by {author_list}"
                        if year:
                            citations_text += f" ({year})"
                        if venue:
                            citations_text += f" - {venue}"
                        if paper_id:
                            citations_text += f" [Paper ID: {paper_id}]"
                        citations_text += "\n"
                    
                    message_content = message_content + citations_text
            
            messages.append({
                "role": msg.role.value,
                "content": message_content,
                "citations": msg.citations  # Also include raw citations for reference
            })
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": f"{context_snippet}Question: {message}" if context_snippet else message,
    })

    try:
        # Get user's timezone from database
        user = db.query(User).filter(User.id == user_id).first()
        user_timezone = user.timezone if user and user.timezone else timezone
        
        # Determine provider and get API key
        model_lower = model.lower()
        if "gemini" in model_lower or model.startswith("google"):
            provider = "gemini"
            llm_factory = "gemini"
            # Remove "gemini/" prefix if present
            llm_name = model.replace("gemini/", "") if model.startswith("gemini/") else model
        elif model.startswith("groq/"):
            provider = "groq"
            llm_factory = "groq"
            llm_name = model.replace("groq/", "") if model.startswith("groq/") else model
        elif model.startswith("ollama") or model.startswith("llama") or model.startswith("mistral") or model.startswith("codellama") or model.startswith("phi"):
            provider = "ollama"
            llm_factory = "ollama"
            llm_name = model
        else:
            provider = "openai"
            llm_factory = "openai"
            llm_name = model
        
        # Get API key from database
        config = await get_llm_config(user_id, provider)
        if not config:
            raise ValueError(f"{provider.capitalize()} API key not found for user {user_id}. Please configure {provider} provider in settings.")
        
        api_key = config.get("api_key")
        if not api_key and provider != "ollama":
            raise ValueError(f"{provider.capitalize()} API key not found for user {user_id}. Please configure {provider} provider in settings.")
        
        # Prepare LLM model config for call_lumen_agent
        llm_model_config = {
            "llm_factory": llm_factory,
            "llm_name": llm_name,
            "api_key": api_key
        }
        
        # Log input messages sent to LLM
        print(f"[CHAT] Input messages to LLM ({len(messages)} messages):")
        for i, msg in enumerate(messages, 1):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            content_preview = content[:200] + "..." if len(content) > 200 else content
            print(f"  [{i}] {role}: {content_preview}")
        
        # Call lumen agent with tools
        response, reasoning_steps, citations, url_contents, google_search_suggestions_html = await call_lumen_agent(
            llm_model_config, messages, timezone=user_timezone
        )
        
        # Check if response is valid
        if not response or (isinstance(response, str) and not response.strip()):
            raise HTTPException(
                status_code=500,
                detail="Agent did not generate a valid response. Please try again."
            )
        
        # Save URL contents to DialogSource if dialog_id exists
        saved_sources = []
        if dialog_id and url_contents:
            for url_content in url_contents:
                # Check if this URL already exists in DialogSource for this dialog
                existing_source = db.query(DialogSource).filter(
                    DialogSource.dialog_id == dialog_id,
                    DialogSource.source_type == SourceTypeEnum.url,
                    DialogSource.source_value == url_content['url']
                ).first()
                
                if not existing_source:
                    # Create new DialogSource entry
                    new_source = DialogSource(
                        dialog_id=dialog_id,
                        file_name=url_content.get('title', url_content['url']),
                        source_type=SourceTypeEnum.url,
                        source_value=url_content['url'],
                        content=url_content.get('content', ''),
                        file_type=url_content.get('type', 'url')
                    )
                    db.add(new_source)
                    saved_sources.append({
                        'url': url_content['url'],
                        'title': url_content.get('title', url_content['url'])
                    })
                else:
                    # Update existing source with new content (in case URL was re-read)
                    existing_source.content = url_content.get('content', existing_source.content)
                    existing_source.file_name = url_content.get('title', existing_source.file_name)
                    saved_sources.append({
                        'url': url_content['url'],
                        'title': url_content.get('title', url_content['url'])
                    })
            
            if saved_sources:
                db.commit()
        
        # Merge URL citations with existing citations if URLs were referenced
        # Check if response mentions URLs from saved sources (even if not from new tool calls)
        final_citations = citations.copy() if citations else []
        
        if dialog_id and url_citations_map and response:
            import re
            # Check if response contains citation patterns like [1], [2], etc.
            # Find all citation references in the response
            citation_refs = re.findall(r'\[(\d+)\]', response)
            
            # Get unique citation indices mentioned in response
            mentioned_indices = set()
            for ref in citation_refs:
                try:
                    idx = int(ref)
                    mentioned_indices.add(idx)
                except:
                    pass
            
            # Merge citations from url_citations_map if they were referenced
            existing_citation_indices = {c.get('index', i+1) for i, c in enumerate(final_citations)}
            
            for url, citation_info in url_citations_map.items():
                citation_index = citation_info['index']
                # If this URL citation was mentioned in response and not already in citations
                if citation_index in mentioned_indices and citation_index not in existing_citation_indices:
                    # Add citation for this URL
                    final_citations.append({
                        'index': citation_index,
                        'url': citation_info['url'],
                        'title': citation_info['title'],
                        'type': citation_info.get('type', 'url')
                    })
        
        # Sort citations by index to ensure consistent ordering
        final_citations.sort(key=lambda x: x.get('index', 0))
        
        # Clean up response: remove citation reference sections that might have been copied from history
        cleaned_response = response if isinstance(response, str) else str(response)
        if cleaned_response:
            import re
            # Simply remove "[References mentioned in this response:]" and everything after it
            # This pattern can be copied by LLM from historical messages
            cleaned_response = re.sub(
                r'\[References mentioned in this response:\].*$',
                '',
                cleaned_response,
                flags=re.DOTALL | re.IGNORECASE
            )
            cleaned_response = re.sub(
                r'\[References from this message:\].*$',
                '',
                cleaned_response,
                flags=re.DOTALL | re.IGNORECASE
            )
            cleaned_response = cleaned_response.strip()
        
        print("Message list: ", message)
        return {
            "message": cleaned_response,
            "reasoning": reasoning_steps if reasoning_steps else None,
            "confidence": None,
            "sources": [],
            "citations": final_citations if final_citations else [],
            "url_contents": saved_sources if saved_sources else None,
            "search_suggestions_html": google_search_suggestions_html,
        }
    except ValueError as e:
        # API key configuration errors
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:  # pragma: no cover - provider/network specific
        error_msg = str(e)
        # Check if it's an API key error
        if "api_key" in error_msg.lower() or "api key" in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail=f"API key configuration error: {error_msg}",
            )
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {error_msg}",
        )



