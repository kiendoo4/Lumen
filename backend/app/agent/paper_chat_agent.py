from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from google.adk.events import Event
from app.agent.tools.search_paper_rag import search_paper_rag
from datetime import datetime
import time
import asyncio
import logging
import json
import re

logger = logging.getLogger(__name__)

def create_paper_chat_agent(document_id: int, document_title: str):
    """Create a specialized agent for chatting with a specific paper"""
    
    agent = LlmAgent(
        name="paper_chat_agent",
        instruction=f"""
You are Lumen, an AI assistant specialized in helping users understand and analyze research papers.

CURRENT DOCUMENT: {document_title}
DOCUMENT ID: {document_id}

CRITICAL RULES:
1. ONLY answer questions based on the content of the current document
2. ALWAYS use the search_paper_rag tool to find relevant information before answering
3. If information is not found in the document, clearly state "I cannot find this information in the provided document"
4. When referencing information, use citations like [1], [2], etc. that correspond to the search results
5. Be precise and accurate in your responses
6. Provide page numbers when available

YOUR CAPABILITIES:
- Answer questions about the document content
- Summarize sections or the entire paper
- Explain concepts and methodologies mentioned in the paper
- Find specific quotes or references
- Compare different parts of the document
- Analyze the paper's contributions and findings

RESPONSE FORMAT:
- Use the search_paper_rag tool first to get relevant content
- Base your answer ONLY on the retrieved content
- Include citations [1], [2], etc. when referencing specific parts
- If page numbers are available, mention them
- Be conversational but accurate

IMPORTANT: Never use your general knowledge about the topic. Only use information retrieved from the current document.
"""
    )
    
    # Add the RAG search tool
    agent.tools = [search_paper_rag]
    
    return agent

async def run_paper_chat_agent(llm_model_config, messages, document_id: int, document_title: str, timezone=None):
    """
    Run the paper chat agent with RAG capabilities
    
    Args:
        llm_model_config: LLM configuration
        messages: Conversation messages
        document_id: ID of the paper document
        document_title: Title of the paper document
        timezone: Optional timezone string
    
    Returns:
        tuple: (response, reasoning_steps, citations, url_contents)
    """
    
    try:
        # Create the specialized agent
        agent = create_paper_chat_agent(document_id, document_title)
        
        # Create the model instance
        model_card = llm_model_config.get('llm_factory').lower() + "/" + llm_model_config.get('llm_name')
        model = LiteLlm(model_card, api_key=llm_model_config.get('api_key'))
        agent.model = model
        
        # Add timezone info if provided
        if timezone:
            try:
                from zoneinfo import ZoneInfo
                tz = ZoneInfo(timezone)
                current_time = datetime.now(tz)
                timezone_name = timezone
            except ImportError:
                try:
                    import pytz
                    tz = pytz.timezone(timezone)
                    current_time = datetime.now(tz)
                    timezone_name = timezone
                except ImportError:
                    current_time = datetime.now()
                    tz = current_time.astimezone().tzinfo
                    timezone_name = timezone
            except Exception:
                current_time = datetime.now()
                tz = current_time.astimezone().tzinfo
                timezone_name = str(tz)
        else:
            current_time = datetime.now()
            tz = current_time.astimezone().tzinfo
            timezone_name = str(tz)
        
        current_date_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
        agent.instruction += f"\n\nThe current date and time is {current_date_str} (Timezone: {timezone_name})"
        
        # Create session
        session_service = InMemorySessionService()
        APP_NAME = "paper_chat"
        USER_ID = "user"
        session_id = f"session_{int(time.time() * 1000)}"
        
        session = await session_service.create_session(
            app_name=APP_NAME, 
            user_id=USER_ID, 
            session_id=session_id
        )
        
        # Process message history
        if messages:
            for msg in messages:
                # Handle different message formats
                if isinstance(msg, dict):
                    role = msg.get("role", "").lower()
                    content = msg.get("content", "")
                elif isinstance(msg, str):
                    role = "user"
                    content = msg
                elif hasattr(msg, "role") and hasattr(msg, "content"):
                    role = getattr(msg, "role", "").lower()
                    content = getattr(msg, "content", "")
                else:
                    continue
                
                # Skip system messages
                if role in ["system"]:
                    continue
                
                # Normalize role names
                if role in ["user", "human"]:
                    author = "user"
                    event_role = "user"
                elif role in ["assistant", "agent", "model", "ai"]:
                    author = "paper_chat_agent"
                    event_role = "model"
                else:
                    continue
                
                # Extract content text
                if isinstance(content, str):
                    content_text = content
                elif isinstance(content, dict):
                    content_text = content.get("text", content.get("content", str(content)))
                elif hasattr(content, "text"):
                    content_text = content.text
                else:
                    content_text = str(content) if content else ""
                
                # Skip empty messages
                if not content_text or not content_text.strip():
                    continue
                
                # Create Event from message
                event = Event(
                    author=author,
                    content=types.Content(
                        role=event_role,
                        parts=[types.Part.from_text(text=content_text)]
                    ),
                    partial=False,
                    invocation_id=f"history_{session_id}",
                    timestamp=time.time()
                )
                
                # Add event to session history
                await session_service.append_event(session, event)
        
        # Create runner
        runner = Runner(agent=agent, app_name=APP_NAME, session_service=session_service)
        
        # Find the latest user message
        latest_user_message = None
        if messages:
            for msg in reversed(messages):
                if isinstance(msg, dict):
                    role = msg.get("role", "").lower()
                    content = msg.get("content", "")
                elif isinstance(msg, str):
                    role = "user"
                    content = msg
                elif hasattr(msg, "role") and hasattr(msg, "content"):
                    role = getattr(msg, "role", "").lower()
                    content = getattr(msg, "content", "")
                else:
                    continue
                
                if role in ["user", "human"]:
                    if isinstance(content, str):
                        content_text = content
                    elif isinstance(content, dict):
                        content_text = content.get("text", content.get("content", str(content)))
                    elif hasattr(content, "text"):
                        content_text = content.text
                    else:
                        content_text = str(content) if content else ""
                    
                    if content_text and content_text.strip():
                        latest_user_message = content_text
                        break
        
        if not latest_user_message:
            latest_user_message = "Hello"
        
        # Modify the user message to include document context
        enhanced_message = f"Question about document '{document_title}' (ID: {document_id}): {latest_user_message}"
        
        new_message_content = types.Content(
            role='user', 
            parts=[types.Part.from_text(text=enhanced_message)]
        )
        
        # Run the agent
        events = []
        reasoning_steps = []
        citations = []
        url_contents = []
        response = ""
        
        async for event in runner.run_async(
            user_id=USER_ID, 
            session_id=session_id, 
            new_message=new_message_content
        ):
            events.append(event)
            
            # Extract tool calls and responses
            if event.content and event.content.parts:
                for part in event.content.parts:
                    # Check if this is a function call
                    if hasattr(part, 'function_call') and part.function_call:
                        func_call = part.function_call
                        tool_name = func_call.name if hasattr(func_call, 'name') else ''
                        args = func_call.args if hasattr(func_call, 'args') else {}
                        
                        # Format args for display
                        args_str = ""
                        if isinstance(args, dict):
                            args_str = ", ".join([f"{k}: {v}" for k, v in args.items()])
                        else:
                            args_str = str(args)
                        
                        reasoning_steps.append({
                            'type': 'tool_call',
                            'tool_name': tool_name,
                            'args': args_str,
                            'timestamp': event.timestamp if hasattr(event, 'timestamp') else time.time()
                        })
                    
                    # Check if this is a function response
                    elif hasattr(part, 'function_response') and part.function_response:
                        func_response = part.function_response
                        tool_name = func_response.name if hasattr(func_response, 'name') else ''
                        result = func_response.response if hasattr(func_response, 'response') else {}
                        
                        # Format result for display
                        result_str = ""
                        if isinstance(result, dict):
                            if 'result' in result:
                                result_str = str(result['result'])
                            else:
                                result_str = str(result)
                        else:
                            result_str = str(result)
                        
                        # Extract citation metadata from search results
                        citation_match = re.search(r'\[CITATION_METADATA\](.*?)\[/CITATION_METADATA\]', result_str, re.DOTALL)
                        if citation_match:
                            try:
                                citation_data = json.loads(citation_match.group(1))
                                citations.extend(citation_data)
                                # Remove citation metadata from display result
                                result_str = re.sub(r'\[CITATION_METADATA\].*?\[/CITATION_METADATA\]', '', result_str, flags=re.DOTALL).strip()
                            except Exception as e:
                                logger.error(f"Error parsing citation metadata: {e}")
                        
                        reasoning_steps.append({
                            'type': 'tool_response',
                            'tool_name': tool_name,
                            'result': result_str,
                            'timestamp': event.timestamp if hasattr(event, 'timestamp') else time.time()
                        })
            
            # Extract final response text
            if event.is_final_response() and event.author == "paper_chat_agent":
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response = part.text
                            break
        
        return response, reasoning_steps, citations, url_contents
        
    except Exception as e:
        logger.error(f"Error in paper chat agent: {e}")
        return f"Error processing request: {str(e)}", [], [], []
    
    finally:
        # Clean up session
        try:
            await session_service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        except Exception:
            pass

async def call_paper_chat_agent(llm_model_config, messages, document_id: int, document_title: str, timezone=None):
    """
    Call the paper chat agent
    
    Args:
        llm_model_config: Dictionary containing LLM configuration
        messages: List of conversation messages
        document_id: ID of the paper document
        document_title: Title of the paper document
        timezone: Optional timezone string
    
    Returns:
        tuple: (response, reasoning_steps, citations, url_contents)
    """
    try:
        return await run_paper_chat_agent(llm_model_config, messages, document_id, document_title, timezone)
    except Exception as e:
        error_msg = f"Error processing paper chat request: {str(e)}"
        logger.error(f"[PAPER_CHAT_AGENT] Error: {error_msg}")
        return "", [], [], []
