from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from google.adk.events import Event
from google.adk.agents import SequentialAgent
from app.agent.tools.search_paper_rag import search_paper_rag
from datetime import datetime
import time
import asyncio
import logging
import json
import re

logger = logging.getLogger(__name__)

def create_todo_planning_agent():
    """Create an agent specialized in creating to-do lists for paper analysis tasks"""
    
    agent = LlmAgent(
        name="todo_planning_agent",
        instruction="""
You are a task planning specialist for academic paper analysis. Break down user queries into structured, actionable to-do lists.

RULES:
1. Output ONLY valid JSON with "tasks" key containing task objects
2. Each task needs: "id", "description", "priority" (1-5), "type"
3. Tasks should extract specific information from the paper
4. Use clear IDs: "research_problem", "methodology", "results", etc.

TASK TYPES:
- "extract": Get specific information, facts, numbers
- "summarize": Summarize sections or concepts  
- "analyze": Analyze relationships, comparisons
- "find": Find specific elements like figures, tables

FOR PAPER SUMMARIES, CREATE THESE TASKS:
1. Research problem identification (priority 5)
2. Motivation and significance (priority 4) 
3. Proposed methodology (priority 5)
4. Key novelty vs prior work (priority 4)
5. Experimental setup (priority 3)
6. Main results and findings (priority 5)
7. Limitations mentioned (priority 2)

FOR SPECIFIC QUESTIONS:
Break into 2-4 focused information extraction and analysis tasks.

EXAMPLE OUTPUT:
{
    "tasks": [
        {
            "id": "research_problem",
            "description": "Identify and extract the main research problem addressed in this paper",
            "priority": 5,
            "type": "extract"
        },
        {
            "id": "methodology", 
            "description": "Summarize the proposed methodology and approach",
            "priority": 4,
            "type": "summarize"
        }
    ]
}

Return ONLY the JSON, no other text.
"""
    )
    
    return agent

def create_synthesis_agent():
    """Create an agent specialized in synthesizing results from to-do tasks into final responses"""
    
    agent = LlmAgent(
        name="synthesis_agent", 
        instruction="""
You are Lumen, an AI assistant specialized in synthesizing information from multiple research tasks into comprehensive, well-structured responses.

CONTEXT:
You will receive:
1. The original user query
2. A to-do list that was created for the query
3. Results from each completed task
4. A citation mapping with numbered references to paper content
5. Conversation history

YOUR JOB:
- Synthesize all task results into a coherent, comprehensive response
- Use the provided citation mapping to reference specific information
- Structure the response logically based on the user's original question
- Ensure accuracy and completeness

CITATION RULES:
- Use citation numbers [1] [2] [3] etc. that correspond to the citation mapping provided
- NEVER use comma-separated citations: [1, 2, 3] 
- Each citation should be separate: [1] [3] [5]
- Only use citation numbers that exist in the provided citation mapping
- Citations refer to specific text chunks from the paper with page numbers when available
- Do not use the citation from text chunks if contained.
- Example: "The main contribution [1] shows that the proposed method [3] achieves better performance."

RESPONSE STRUCTURE:
- Start with a direct answer to the user's question
- Organize information logically (chronological, importance, etc.)
- Use clear headings and bullet points when appropriate
- End with a summary if the response is long

IMPORTANT:
- Base your response ONLY on the provided task results
- Do not add information not found in the task results
- If information is missing, acknowledge it clearly
- Maintain the conversational but professional tone
"""
    )
    
    return agent

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
- Include citations [1], [2], etc. when referencing specific parts (IMPORTANT: Use separate citations like [1] [2] instead of [1, 2])
- If page numbers are available, mention them
- Be conversational but accurate

CITATION FORMATTING RULES:
- ALWAYS use individual citation numbers: [1] [2] [3]
- NEVER use comma-separated citations: [1, 2, 3]
- Each citation should be separate for better UI rendering
- Example: "This concept is supported by multiple sources [1] [3] [5]" NOT "This concept is supported by multiple sources [1, 3, 5]"

IMPORTANT: Never use your general knowledge about the topic. Only use information retrieved from the current document.
"""
    )
    
    # Add the RAG search tool
    agent.tools = [search_paper_rag]
    
    return agent

async def run_paper_chat_agent_with_planning(llm_model_config, messages, document_id: int, document_title: str, timezone=None):
    """
    Run the paper chat agent with task planning and RAG capabilities
    
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
        # --- Prompt/context budgeting helpers (keep quality but avoid huge prompts) ---
        def _truncate_text(text: str, max_chars: int) -> str:
            if not text:
                return ""
            if len(text) <= max_chars:
                return text
            return text[: max_chars - 12] + "\n... (truncated)"

        def _is_unhelpful_result(text: str) -> bool:
            if not text:
                return True
            t = text.lower()
            return any(
                p in t
                for p in [
                    "no relevant",
                    "not found",
                    "cannot find",
                    "i cannot find",
                    "no information",
                    "error",
                    "failed to",
                ]
            )

        def _dedupe_citations(citations_list: list) -> list:
            seen = set()
            out = []
            for c in citations_list or []:
                key = (
                    c.get("page_number"),
                    c.get("start_char"),
                    c.get("end_char"),
                    (c.get("content") or "")[:120],
                )
                if key in seen:
                    continue
                seen.add(key)
                out.append(c)
            return out

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
        
        # Initialize tracking variables
        reasoning_steps = []
        citations = []
        url_contents = []
        citation_index_counter = 0
        
        # Step 1: Create to-do list using planning agent
        logger.info("Step 1: Creating to-do list...")
        reasoning_steps.append({
            'type': 'planning_start',
            'message': f'Creating task plan for: "{latest_user_message}"',
            'timestamp': time.time()
        })
        
        todo_agent = create_todo_planning_agent()
        model_card = llm_model_config.get('llm_factory').lower() + "/" + llm_model_config.get('llm_name')
        model = LiteLlm(model_card, api_key=llm_model_config.get('api_key'))
        todo_agent.model = model
        
        # Create session for todo planning
        session_service = InMemorySessionService()
        APP_NAME = "paper_chat_planning"
        USER_ID = "user"
        session_id = f"todo_session_{int(time.time() * 1000)}"
        
        session = await session_service.create_session(
            app_name=APP_NAME, 
            user_id=USER_ID, 
            session_id=session_id
        )
        
        runner = Runner(agent=todo_agent, app_name=APP_NAME, session_service=session_service)
        
        # Create planning prompt
        planning_prompt = f"""
Create a to-do list for this query about the paper "{document_title}":

Query: {latest_user_message}

Consider the type of question and break it down into specific, actionable tasks that will help gather the necessary information from the paper to provide a comprehensive answer.
"""
        
        new_message_content = types.Content(
            role='user', 
            parts=[types.Part.from_text(text=planning_prompt)]
        )
        
        todo_list_json = ""
        async for event in runner.run_async(
            user_id=USER_ID, 
            session_id=session_id, 
            new_message=new_message_content
        ):
            if event.is_final_response() and event.author == "todo_planning_agent":
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            todo_list_json = part.text
                            break
        
        # Clean up todo session
        await session_service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        
        # Parse to-do list
        try:
            # Clean the JSON response (remove any markdown formatting)
            clean_json = todo_list_json.strip()
            if clean_json.startswith('```json'):
                clean_json = clean_json.replace('```json', '').replace('```', '').strip()
            elif clean_json.startswith('```'):
                clean_json = clean_json.replace('```', '').strip()
            
            todo_list = json.loads(clean_json)
            tasks = todo_list.get("tasks", [])
            
            # If no tasks or invalid structure, create structured tasks based on query type
            if not tasks:
                raise ValueError("No tasks found in response")
                
        except Exception as e:
            logger.error(f"Error parsing todo list: {e}")
            logger.error(f"Raw response: {todo_list_json}")
            
            # Create structured fallback tasks based on query type
            query_lower = latest_user_message.lower()
            
            if "summarize" in query_lower or "summary" in query_lower:
                tasks = [
                    {
                        "id": "research_problem",
                        "description": "Identify and extract the main research problem or question addressed in this paper",
                        "priority": 5,
                        "type": "extract"
                    },
                    {
                        "id": "motivation",
                        "description": "Extract the motivation and significance of why this research matters",
                        "priority": 4,
                        "type": "extract"
                    },
                    {
                        "id": "methodology",
                        "description": "Summarize the proposed methodology and approach used in the study",
                        "priority": 5,
                        "type": "summarize"
                    },
                    {
                        "id": "key_novelty",
                        "description": "Identify what is new in this work compared to prior research",
                        "priority": 4,
                        "type": "analyze"
                    },
                    {
                        "id": "experimental_setup",
                        "description": "Extract information about the experimental setup and evaluation methodology",
                        "priority": 3,
                        "type": "extract"
                    },
                    {
                        "id": "main_results",
                        "description": "Extract the main results, key findings, and important numbers or trends",
                        "priority": 5,
                        "type": "extract"
                    },
                    {
                        "id": "limitations",
                        "description": "Identify any limitations or weaknesses mentioned by the authors",
                        "priority": 2,
                        "type": "extract"
                    }
                ]
            elif any(word in query_lower for word in ["method", "approach", "algorithm", "technique"]):
                tasks = [
                    {
                        "id": "methodology_overview",
                        "description": "Extract and summarize the main methodology or approach described",
                        "priority": 5,
                        "type": "summarize"
                    },
                    {
                        "id": "technical_details",
                        "description": "Find specific technical details, algorithms, or implementation aspects",
                        "priority": 4,
                        "type": "extract"
                    },
                    {
                        "id": "comparison_prior_work",
                        "description": "Analyze how this method compares to existing approaches",
                        "priority": 3,
                        "type": "analyze"
                    }
                ]
            elif any(word in query_lower for word in ["result", "finding", "performance", "evaluation"]):
                tasks = [
                    {
                        "id": "main_results",
                        "description": "Extract the main experimental results and key findings",
                        "priority": 5,
                        "type": "extract"
                    },
                    {
                        "id": "performance_metrics",
                        "description": "Find specific performance metrics, numbers, and evaluation results",
                        "priority": 4,
                        "type": "extract"
                    },
                    {
                        "id": "result_analysis",
                        "description": "Analyze what the results mean and their implications",
                        "priority": 3,
                        "type": "analyze"
                    }
                ]
            else:
                # General query - create a focused task
                tasks = [
                    {
                        "id": "information_extraction",
                        "description": f"Search for and extract information relevant to: {latest_user_message}",
                        "priority": 5,
                        "type": "extract"
                    },
                    {
                        "id": "context_analysis",
                        "description": "Analyze the context and provide comprehensive understanding of the topic",
                        "priority": 4,
                        "type": "analyze"
                    }
                ]
        
        reasoning_steps.append({
            'type': 'todo_list_created',
            'todo_list': tasks,
            'timestamp': time.time()
        })
        
        # Step 2: Execute each task using the RAG agent
        logger.info(f"Step 2: Executing {len(tasks)} tasks...")
        task_results = []
        
        for i, task in enumerate(tasks):
            task_id = task.get("id", f"task_{i}")
            task_description = task.get("description", "")
            
            reasoning_steps.append({
                'type': 'task_start',
                'task_id': task_id,
                'task_description': task_description,
                'timestamp': time.time()
            })
            
            # Execute task using RAG
            try:
                rag_result = search_paper_rag(task_description, document_id, limit=5)
                
                # Extract citation metadata
                citation_match = re.search(r'\[CITATION_METADATA\](.*?)\[/CITATION_METADATA\]', rag_result, re.DOTALL)
                if citation_match:
                    try:
                        citation_data = json.loads(citation_match.group(1))
                        # Re-index citations to ensure unique sequential indices
                        for citation in citation_data:
                            citation_index_counter += 1
                            citation['index'] = citation_index_counter
                            citation['task_id'] = task_id
                        citations.extend(citation_data)
                        logger.info(f"Task {task_id}: Added {len(citation_data)} citations, total citations: {len(citations)}")
                        # Remove citation metadata from result
                        clean_result = re.sub(r'\[CITATION_METADATA\].*?\[/CITATION_METADATA\]', '', rag_result, flags=re.DOTALL).strip()
                    except Exception as e:
                        logger.error(f"Error parsing citation metadata: {e}")
                        clean_result = rag_result
                else:
                    clean_result = rag_result
                
                task_results.append({
                    "task_id": task_id,
                    "task_description": task_description,
                    # Keep results compact to avoid bloating synthesis prompt; raw citations are preserved separately.
                    "result": _truncate_text(clean_result, 2000),
                    "citations_count": len([c for c in citations if c.get('task_id') == task_id])
                })
                
                reasoning_steps.append({
                    'type': 'task_completed',
                    'task_id': task_id,
                    'result_preview': clean_result[:200] + "..." if len(clean_result) > 200 else clean_result,
                    'citations_found': len([c for c in citations if c.get('task_id') == task_id]),
                    'timestamp': time.time()
                })
                
            except Exception as e:
                logger.error(f"Error executing task {task_id}: {e}")
                reasoning_steps.append({
                    'type': 'task_error',
                    'task_id': task_id,
                    'error': str(e),
                    'timestamp': time.time()
                })
        
        # Step 3: Synthesize results using synthesis agent
        logger.info("Step 3: Synthesizing final response...")
        reasoning_steps.append({
            'type': 'synthesis_start',
            'message': 'Synthesizing results from all tasks into final response',
            'timestamp': time.time()
        })
        
        synthesis_agent = create_synthesis_agent()
        synthesis_agent.model = model
        
        # Create synthesis session
        synthesis_session_id = f"synthesis_session_{int(time.time() * 1000)}"
        synthesis_session = await session_service.create_session(
            app_name=APP_NAME, 
            user_id=USER_ID, 
            session_id=synthesis_session_id
        )
        
        synthesis_runner = Runner(agent=synthesis_agent, app_name=APP_NAME, session_service=session_service)
        
        # Create citation mapping for synthesis agent
        # Keep only the most useful citations to avoid excessive prompt size.
        citations = _dedupe_citations(citations)

        # Prefer citations from higher-priority tasks, and drop citations from obviously unhelpful results.
        task_priority = {t.get("id"): int(t.get("priority", 0) or 0) for t in tasks}
        task_result_by_id = {tr.get("task_id"): tr for tr in task_results}

        filtered = []
        for c in citations:
            tid = c.get("task_id")
            tr = task_result_by_id.get(tid, {})
            if tr and _is_unhelpful_result(tr.get("result", "")):
                continue
            filtered.append(c)

        filtered.sort(key=lambda c: (task_priority.get(c.get("task_id"), 0), c.get("page_number") or 0), reverse=True)
        max_citations_for_prompt = 20
        filtered = filtered[:max_citations_for_prompt]

        citation_mapping = {}
        for citation in filtered:
            citation_mapping[citation['index']] = {
                # Truncate content per-citation so mapping stays small but still quotable.
                'content': _truncate_text(citation.get('content', ''), 900),
                'page_number': citation.get('page_number'),
                'start_char': citation.get('start_char'),
                'end_char': citation.get('end_char'),
                'document_title': citation.get('document_title', document_title),
                'task_id': citation.get('task_id', 'unknown')
            }
        
        logger.info(f"Created citation mapping with {len(citation_mapping)} citations: {list(citation_mapping.keys())}")
        
        # Prepare synthesis prompt (budgeted)
        # Keep a short conversation history only.
        convo_tail = messages[-5:] if messages else []
        convo_history = [
            {"role": msg.get("role", "user"), "content": _truncate_text(str(msg.get("content", "")), 600)}
            for msg in convo_tail
            if isinstance(msg, dict)
        ]

        tasks_for_prompt = tasks[:10]
        task_results_for_prompt = task_results[:10]

        synthesis_prompt = f"""
ORIGINAL QUERY: {latest_user_message}

DOCUMENT: {document_title}

TO-DO LIST EXECUTED:
{json.dumps(tasks_for_prompt, indent=2)}

TASK RESULTS:
{json.dumps(task_results_for_prompt, indent=2)}

CITATION MAPPING:
{json.dumps(citation_mapping, indent=2)}

CONVERSATION HISTORY:
{json.dumps(convo_history, indent=2)}

INSTRUCTIONS:
Please synthesize all the task results into a comprehensive, well-structured response to the original query. 

CITATION RULES:
- Use citation numbers [1] [2] [3] etc. to reference specific information from the citation mapping above
- Each citation number corresponds to a specific text chunk from the paper
- Use separate citations like [1] [2] [3], NOT comma-separated like [1, 2, 3]
- Only use citation numbers that exist in the citation mapping above
- Include page numbers when available: "According to the methodology [1], the approach..."
"""
        
        synthesis_message_content = types.Content(
            role='user', 
            parts=[types.Part.from_text(text=synthesis_prompt)]
        )
        
        final_response = ""
        async for event in synthesis_runner.run_async(
            user_id=USER_ID, 
            session_id=synthesis_session_id, 
            new_message=synthesis_message_content
        ):
            if event.is_final_response() and event.author == "synthesis_agent":
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            final_response = part.text
                            break
        
        # Clean up synthesis session
        await session_service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=synthesis_session_id)
        
        reasoning_steps.append({
            'type': 'synthesis_completed',
            'message': 'Final response generated successfully',
            'timestamp': time.time()
        })
        
        return final_response, reasoning_steps, citations, url_contents
        
    except Exception as e:
        logger.error(f"Error in paper chat agent with planning: {e}")
        return f"Error processing request: {str(e)}", [], [], []

async def run_paper_chat_agent(llm_model_config, messages, document_id: int, document_title: str, timezone=None):
    """
    Run the paper chat agent with RAG capabilities (original implementation for backward compatibility)
    
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
        citation_index_counter = 0  # Track citation index across multiple tool calls
        
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
                                # Re-index citations to ensure unique sequential indices
                                for citation in citation_data:
                                    citation_index_counter += 1
                                    citation['index'] = citation_index_counter
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

async def call_paper_chat_agent(llm_model_config, messages, document_id: int, document_title: str, timezone=None, use_planning=True):
    """
    Call the paper chat agent
    
    Args:
        llm_model_config: Dictionary containing LLM configuration
        messages: List of conversation messages
        document_id: ID of the paper document
        document_title: Title of the paper document
        timezone: Optional timezone string
        use_planning: Whether to use task planning (default: True)
    
    Returns:
        tuple: (response, reasoning_steps, citations, url_contents)
    """
    try:
        if use_planning:
            return await run_paper_chat_agent_with_planning(llm_model_config, messages, document_id, document_title, timezone)
        else:
            return await run_paper_chat_agent(llm_model_config, messages, document_id, document_title, timezone)
    except Exception as e:
        error_msg = f"Error processing paper chat request: {str(e)}"
        logger.error(f"[PAPER_CHAT_AGENT] Error: {error_msg}")
        return "", [], [], []
