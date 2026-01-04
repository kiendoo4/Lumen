from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.adk.tools import FunctionTool
from google.genai import types
from google.adk.events import Event
from functools import partial
import string
import asyncio
import time
from datetime import datetime

# Import tools
from app.agent.tools.search_duckduckgo import search_duckduckgo
from app.agent.tools.search_url import search_url

root_agent = LlmAgent(
    name="root_agent",
    instruction="""
You are Lumen, an AI assistant designed to help users with research and information gathering.

Your capabilities include:
1. Answering questions based on your knowledge
2. Searching the web using DuckDuckGo when you need current information or are uncertain about an answer
3. Reading and extracting information from specific URLs when users ask you to visit a webpage

Guidelines:
- ALWAYS use the search_duckduckgo tool when:
  * Users ask about research papers, academic papers, scientific publications, or scholarly articles
  * Users ask about current events, recent news, or up-to-date information
  * Users ask about specific topics that may have recent developments or updates
  * You are not certain about an answer or need to verify information
  * Users ask for recommendations, lists, or collections of resources (papers, articles, websites, etc.)
  * The question requires finding specific information that might not be in your training data

- Use the search_url tool when:
  * Users explicitly ask you to visit a specific URL or webpage
  * Users provide a URL and ask you to read or extract information from it
  * Users say "go to this website", "read this page", "check this link", etc.

- Always provide clear, accurate, and helpful responses
- Cite your sources when using information from web searches or URLs
- If you cannot find the information requested after searching, be honest about it and suggest alternatives
- Do NOT say you cannot help without first trying to search for the information using the search_duckduckgo tool
"""
)

async def run_lumen_agent(llm_model_config, messages, timezone=None):
    """
    Async function to handle the lumen agent execution

    Args:
       llm_model_config
            - llm_factory: The LLM factory name
            - llm_name: The LLM model name  
            - api_key: API key for the LLM
        messages: List of conversation messages
        timezone: Optional timezone string (e.g., "America/New_York", "Asia/Ho_Chi_Minh", "UTC")

    Returns: response of the agent, processed events
    """
    
    # Create the model instance from the LLM configuration
    model_card = llm_model_config.get('llm_factory').lower() + "/" + llm_model_config.get('llm_name')
    model = LiteLlm(model_card, api_key=llm_model_config.get('api_key'))
    root_agent.model = model
    root_agent.tools = [search_duckduckgo, search_url]
    
    # Add current date and timezone to instruction
    print(f"[LUMEN_AGENT] Received timezone: {timezone}")
    if timezone:
        # Use user's timezone if provided
        try:
            # Try to use zoneinfo (Python 3.9+)
            try:
                from zoneinfo import ZoneInfo
                tz = ZoneInfo(timezone)
                current_time = datetime.now(tz)
                timezone_name = timezone
            except ImportError:
                # Fallback for Python < 3.9: try pytz if available
                try:
                    import pytz
                    tz = pytz.timezone(timezone)
                    current_time = datetime.now(tz)
                    timezone_name = timezone
                except ImportError:
                    # No timezone library available, use system timezone
                    current_time = datetime.now()
                    tz = current_time.astimezone().tzinfo
                    timezone_name = timezone  # Still show user's requested timezone name
        except Exception as e:
            # Invalid timezone, fallback to system timezone
            current_time = datetime.now()
            tz = current_time.astimezone().tzinfo
            timezone_name = str(tz)
            # Try to get a more readable timezone name
            try:
                if hasattr(tz, 'zone'):
                    timezone_name = tz.zone
                elif hasattr(tz, 'tzname'):
                    tzname = tz.tzname(current_time)
                    if tzname:
                        timezone_name = tzname
            except:
                pass
    else:
        # Use system timezone
        current_time = datetime.now()
        tz = current_time.astimezone().tzinfo
        timezone_name = str(tz)
        # Try to get a more readable timezone name
        try:
            if hasattr(tz, 'zone'):
                timezone_name = tz.zone
            elif hasattr(tz, 'tzname'):
                tzname = tz.tzname(current_time)
                if tzname:
                    timezone_name = tzname
        except:
            pass
    
    current_date_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
    root_agent.instruction += f"\n\nThe current date and time is {current_date_str} (Timezone: {timezone_name})"

    
    session_service = InMemorySessionService()
    APP_NAME = "lumen"
    USER_ID = "kdoo"
    # Generate a unique session ID for each request
    session_id = f"session_{int(time.time() * 1000)}"
    
    # Create shared container for retrieval_infos
    shared_container = {}
    
    try:
        # Create session asynchronously
        session = await session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        
        # Process message history (skip system messages as instruction is already in agent)
        if messages:
            for msg in messages:
                # Handle different message formats
                # Case 1: dict with "role" and "content"
                if isinstance(msg, dict):
                    role = msg.get("role", "").lower()
                    content = msg.get("content", "")
                # Case 2: string (treat as user message)
                elif isinstance(msg, str):
                    role = "user"
                    content = msg
                # Case 3: object with attributes
                elif hasattr(msg, "role") and hasattr(msg, "content"):
                    role = getattr(msg, "role", "").lower()
                    content = getattr(msg, "content", "")
                else:
                    continue  # Skip unknown formats
                
                # Skip system messages (instruction is already in agent)
                if role in ["system"]:
                    continue
                
                # Normalize role names
                if role in ["user", "human"]:
                    author = "user"
                    event_role = "user"
                elif role in ["assistant", "agent", "model", "ai"]:
                    author = "root_agent"
                    event_role = "model"
                else:
                    continue  # Skip unknown roles
                
                # Extract content text (handle different content formats)
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

        runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)
        
        # Find the latest user message to send
        latest_user_message = None
        if messages:
            # Go backwards to find the last user message
            for msg in reversed(messages):
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
                
                if role in ["user", "human"]:
                    # Extract content text
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
        
        # Fallback to default if no user message found
        if not latest_user_message:
            latest_user_message = "Hello"
        
        new_message_content = types.Content(
            role='user', 
            parts=[types.Part.from_text(text=latest_user_message)]
        )

        events = []
        response = ""
        async for event in runner.run_async(
            user_id=USER_ID, 
            session_id=session_id, 
            new_message=new_message_content
        ):
            print("lmeo: ", event.content.parts)
            if event.is_final_response():
                events += [event]
                if event.author == "root_agent":
                    response = event.content.parts[0].text if event.content.parts and event.content.parts[0].text else ""
        
        return response, events
        
    finally:
        # Clean up session asynchronously
        try:
            await session_service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        except Exception:
            pass  # Ignore cleanup errors  

async def call_lumen_agent(llm_model_config, messages, timezone=None):
    """
    Call the root_agent with a query and perform_retrieval function.

    Args:
        llm_model_config: Dictionary containing LLM configuration with keys:
            - llm_factory: The LLM factory name
            - llm_name: The LLM model name  
            - api_key: API key for the LLM
        messages: List of conversation messages
        timezone: Optional timezone string (e.g., "America/New_York", "Asia/Ho_Chi_Minh", "UTC")
    Returns:
        tuple: (response of the agent, processed events)
    """
    try:
        # Await the async function directly (since we're already in an async context)
        return await run_lumen_agent(llm_model_config, messages, timezone)
    except Exception as e:
        # Return error message if something goes wrong
        error_msg = f"Error processing request: {str(e)}"
        print(f"[LUMEN_AGENT] Error: {error_msg}")
        return "", []