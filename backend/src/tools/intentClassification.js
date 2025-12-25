/**
 * Tool: Intent Classification
 * Determines question type and requirements
 */
export class IntentClassificationTool {
  async classify(question) {
    // TODO: Implement classification logic
    return {
      question_type: 'understanding',
      requires_external_evidence: false,
      requires_paper_context: true
    };
  }
}


