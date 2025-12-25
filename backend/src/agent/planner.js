/**
 * Planner
 * Generates execution plan based on intent and context
 */
export class Planner {
  createPlan(intent, context) {
    // TODO: Implement planning logic
    return {
      steps: [
        { tool: 'paper_retrieval', params: {} },
        { tool: 'claim_extraction', params: {} }
      ]
    };
  }
}


