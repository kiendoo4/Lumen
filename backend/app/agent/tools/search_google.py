"""
Google Search tool integration for ADK (Gemini-only).

IMPORTANT (per ADK docs):
- The built-in `google_search` tool is only compatible with Gemini 2 models.
- There is a single-tool-per-agent limitation for `google_search`. ADK provides
  `GoogleSearchAgentTool` as a workaround so we can still use other tools in the
  parent agent.

This module exposes a small helper to build a tool instance that can be
attached to our main agent.
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools.google_search_agent_tool import (
    GoogleSearchAgentTool,
    create_google_search_agent,
)


def build_google_search_tool(model) -> GoogleSearchAgentTool:
    """
    Build a Google Search tool that can be used alongside other tools.

    Args:
        model: A Gemini 2.x model (string model name or ADK BaseLlm).

    Returns:
        GoogleSearchAgentTool wrapping a sub-agent that only uses google_search.
    """
    agent: LlmAgent = create_google_search_agent(model=model)
    return GoogleSearchAgentTool(agent=agent)




