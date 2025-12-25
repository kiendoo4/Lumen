/**
 * Reasoning State Manager
 * Manages agent reasoning state
 */
export class ReasoningState {
  constructor() {
    this.state = {
      user_question: '',
      intent: '',
      papers: [],
      claims: [],
      supporting_evidence: [],
      conflicting_evidence: [],
      uncertainties: [],
      confidence: null
    };
  }

  update(updates) {
    this.state = { ...this.state, ...updates };
  }

  get() {
    return { ...this.state };
  }

  reset() {
    this.state = {
      user_question: '',
      intent: '',
      papers: [],
      claims: [],
      supporting_evidence: [],
      conflicting_evidence: [],
      uncertainties: [],
      confidence: null
    };
  }
}


