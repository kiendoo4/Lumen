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
from app.agent.tools.search_google import build_google_search_tool
from app.agent.tools.search_url import search_url
from app.agent.tools.search_semantic_scholar import (
    search_semantic_scholar,
    get_paper_by_id,
    get_author_by_id,
    search_authors,
    get_paper_citations,
    get_paper_references,
    get_recommended_papers,
    get_author_papers
)

root_agent = LlmAgent(
    name="root_agent",
    instruction="""
You are Lumen, an AI assistant designed to help users with research and information gathering.

CRITICAL RULE - KNOWLEDGE USAGE:
- DO NOT use your own pretrained knowledge to answer questions
- ONLY use information that is provided in the conversation context or retrieved through the available tools
- If the required information is not available in the conversation context or cannot be retrieved through tools, you MUST respond clearly that you do not know the answer
- Never make up information or use information from your training data that is not explicitly provided in the current conversation context

Your capabilities include:
1. Answering questions based ONLY on information from conversation context or tools (NOT from your pretrained knowledge)
2. Searching the web using Google Search when you need current information or are uncertain about an answer
3. Reading and extracting information from specific URLs when users ask you to visit a webpage
4. Comprehensive Semantic Scholar API tools for academic research

Semantic Scholar + Google Search (primary tools for retrieval):
- search_semantic_scholar: Search for academic papers by keywords, topics, or titles.
- get_paper_by_id: Get detailed information about a specific paper using its ID, DOI, or arXiv ID.
- search_authors: Search for researchers/authors by name.
- get_author_by_id: Get detailed information about an author including their papers, citations, and h-index.
- get_paper_citations: Get all papers that cite a specific paper (forward citations).
- get_paper_references: Get all papers that a specific paper references (bibliography).
- get_recommended_papers: Get paper recommendations based on a seed paper.
- get_author_papers: Get all papers published by a specific author.
- Google Search tool: High-quality web search for both academic context (e.g., finding PDFs, project pages, blogs) and non-academic information.

Guidelines:
- ALWAYS use search_semantic_scholar when:
  * Users ask about research papers, academic papers, scientific publications, or scholarly articles
  * Users want to find papers on a specific topic, by a specific author, or with specific keywords
  * Users ask for academic literature, scientific studies, or research publications
  * Prefer it when you need structured academic metadata (authors, venue, citations, references, paper IDs)

- Use get_paper_by_id when:
  * Users explicitly provide a paper ID (e.g., "paper ID: 123456") or DOI
  * Users provide a Semantic Scholar paper ID or URL (e.g., https://www.semanticscholar.org/paper/...)
  * Users want detailed metadata about a paper from Semantic Scholar database
  * You need comprehensive metadata about a paper (citations, references, fields of study, etc.)
  * IMPORTANT: Do NOT use get_paper_by_id for PDF URLs (like arxiv.org/pdf/...). Use search_url instead to read the PDF content.
  * Do NOT try to extract paper ID from PDF URLs - if user provides a PDF URL and asks to read it, use search_url.

- Use search_authors when:
  * Users want to find researchers or authors by name
  * Users ask "who is [author name]" or "find papers by [author]"

- Use get_author_by_id when:
  * You have an author ID and need their detailed profile, statistics, and publications
  * Users want to see an author's h-index, total citations, or recent papers

- Use get_paper_citations when:
  * Users want to see who cited a specific paper
  * Users ask "what papers cite this paper" or "who cited [paper]"

- Use get_paper_references when:
  * Users want to see the bibliography/references of a specific paper
  * Users ask "what papers does this paper reference" or "show references of [paper]"

- Use get_recommended_papers when:
  * Users have a specific paper ID and want similar or related papers
  * Users ask for recommendations based on a paper they're interested in

- Use get_author_papers when:
  * Users want to see all papers by a specific author
  * You have an author ID and need their publication list

- Use the Google Search tool when:
  * Users ask about current events, recent news, or up-to-date information
  * Users ask about specific topics that may have recent developments or updates (non-academic)
  * You are not certain about an answer or need to verify information (non-academic)
  * Users ask for general web recommendations, lists, or collections of resources (non-academic)
  * The question requires finding specific information that might not be in your training data (non-academic)

- Use the search_url tool when:
  * Users explicitly ask you to visit a specific URL or webpage
  * Users provide a URL (including PDF URLs like arxiv.org/pdf/...) and ask you to read or extract information from it
  * Users say "go to this website", "read this page", "check this link", etc.
  * Users provide a PDF URL (e.g., https://arxiv.org/pdf/1806.10574) - use search_url to read the PDF content directly
  * IMPORTANT: When user says "read this link" or "vào link này đọc", ALWAYS use search_url, NOT get_paper_by_id
  * The search_url tool can handle both HTML pages and PDF files (including arXiv PDFs)

- Always provide clear, accurate, and helpful responses
- Cite your sources when using information from web searches or URLs
- When citing sources from search results, use the format ##i$$ where i is the index number (1, 2, 3, etc.) to reference the search result. For example, if you mention information from the first search result, use ##1$$, from the second result use ##2$$, and so on.
- The citation format ##i$$ will be automatically rendered as a clickable citation link in the UI
- IMPORTANT: When users reference papers from previous messages (e.g., "the first paper", "paper [1]", "that paper about X"), check the conversation history for citations. Previous messages include a "[References mentioned in this response:]" section that lists all papers with their titles, authors, years, and paper IDs. You can reference these papers directly without needing to search again.
- If a user asks about a paper that was mentioned in a previous message, you can refer to it using the citation number from that message.
- IMPORTANT: When you use search_url to read a URL, that URL's content is automatically saved in the conversation context. If the user later asks about information from a URL that was read earlier, you can reference it using citations. The system will show you "[Previously accessed URLs in this conversation:]" with their content previews. Use the citation format [1], [2], etc. to reference these URLs when answering questions based on their content.
- If you cannot find the information requested after searching, be honest about it and suggest alternatives
- Do NOT say you cannot help without first trying to search for the information using the Google Search tool
- REMEMBER: Do NOT use your pretrained knowledge. Only use information present in the conversation context or retrieved via the tools above. If the required context is not provided or cannot be found through tools, respond clearly that you do not know.
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
    llm_factory = (llm_model_config.get('llm_factory') or '').lower()
    llm_name = llm_model_config.get('llm_name') or ''
    model_card = llm_factory + "/" + llm_name
    print("model_card: ", model_card)
    model = LiteLlm(model_card, api_key=llm_model_config.get('api_key'))
    root_agent.model = model

    google_search_tool = build_google_search_tool(model)

    root_agent.tools = [
        # Web search
        google_search_tool,
        # URL reading
        search_url,
        # Academic tools
        search_semantic_scholar,
        get_paper_by_id,
        get_author_by_id,
        search_authors,
        get_paper_citations,
        get_paper_references,
        get_recommended_papers,
        get_author_papers,
    ]
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
        reasoning_steps = []  # Store tool calls for reasoning display
        citations = []  # Store citation metadata from search results
        url_contents = []  # Store URL content for database storage
        google_search_suggestions_html = None  # renderedContent requirement (if returned)
        response = ""
        async for event in runner.run_async(
            user_id=USER_ID, 
            session_id=session_id, 
            new_message=new_message_content
        ):
            print("lmeo: ", event.content.parts)
            events += [event]

            # Capture grounding metadata from Google Search tool (if present).
            # GoogleSearchAgentTool stores it in state as `temp:_adk_grounding_metadata`.
            try:
                if hasattr(event, "actions") and event.actions and getattr(event.actions, "state_delta", None):
                    state_delta = event.actions.state_delta
                    if isinstance(state_delta, dict) and "temp:_adk_grounding_metadata" in state_delta:
                        gm = state_delta.get("temp:_adk_grounding_metadata")
                        # Try common shapes:
                        # - dict: {"renderedContent": "<html...>"}
                        # - object with attribute rendered_content/renderedContent
                        if isinstance(gm, dict):
                            google_search_suggestions_html = (
                                gm.get("renderedContent")
                                or gm.get("rendered_content")
                                or google_search_suggestions_html
                            )
                        else:
                            google_search_suggestions_html = (
                                getattr(gm, "rendered_content", None)
                                or getattr(gm, "renderedContent", None)
                                or google_search_suggestions_html
                            )
            except Exception:
                pass
            
            # Extract tool calls and responses for reasoning display
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
                        
                        # Format result for display (truncate if too long)
                        result_str = ""
                        if isinstance(result, dict):
                            if 'result' in result:
                                result_str = str(result['result'])
                            else:
                                result_str = str(result)
                        else:
                            result_str = str(result)
                        
                        # Extract citation metadata from search results
                        semantic_scholar_tools = [
                            'search_semantic_scholar',
                            'get_paper_by_id',
                            'get_author_by_id',
                            'search_authors',
                            'get_paper_citations',
                            'get_paper_references',
                            'get_recommended_papers',
                            'get_author_papers'
                        ]
                        import json
                        import re
                        
                        # Look for citation metadata in the result
                        citation_match = re.search(r'\[CITATION_METADATA\](.*?)\[/CITATION_METADATA\]', result_str, re.DOTALL)
                        if citation_match:
                            try:
                                citation_data = json.loads(citation_match.group(1))
                                
                                # Handle search_url tool specifically - store URL content
                                if tool_name == 'search_url' and citation_data:
                                    for citation in citation_data:
                                        # Store URL content for database persistence
                                        if 'url' in citation and 'full_content' in citation:
                                            url_contents.append({
                                                'url': citation['url'],
                                                'title': citation.get('title', citation['url']),
                                                'content': citation['full_content'],
                                                'type': citation.get('type', 'url')
                                            })
                                
                                # Add to citations list
                                citations.extend(citation_data)
                                # Remove citation metadata from display result
                                result_str = re.sub(r'\[CITATION_METADATA\].*?\[/CITATION_METADATA\]', '', result_str, flags=re.DOTALL).strip()
                            except Exception as e:
                                print(f"[CALL_LLM] Error parsing citation metadata: {e}")
                                pass
                        
                        # Store full result (don't truncate, let frontend handle it)
                        reasoning_steps.append({
                            'type': 'tool_response',
                            'tool_name': tool_name,
                            'result': result_str,  # Full result, no truncation
                            'timestamp': event.timestamp if hasattr(event, 'timestamp') else time.time()
                        })
            
            # Extract final response text
            if event.is_final_response() and event.author == "root_agent":
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response = part.text
                            break
        
        # Per Google Search grounding requirement:
        # If the model provides Search suggestions UI HTML ("renderedContent"),
        # forward it to the frontend so it can be displayed.
        if google_search_suggestions_html:
            reasoning_steps.append(
                {
                    "type": "google_search_suggestions",
                    "rendered_content": google_search_suggestions_html,
                    "timestamp": time.time(),
                }
            )

        return response, reasoning_steps, citations, url_contents, google_search_suggestions_html
        
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
        return "", [], [], [], None