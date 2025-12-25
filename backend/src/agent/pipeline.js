import { IntentAnalyzer } from './intentAnalyzer.js';
import { ScopeValidator } from './scopeValidator.js';
import { Planner } from './planner.js';
import { ToolExecutor } from './toolExecutor.js';
import { EvidenceSynthesizer } from './evidenceSynthesizer.js';
import { ResponseComposer } from './responseComposer.js';
import { ReasoningState } from '../state/reasoningState.js';

/**
 * Main Agent Pipeline
 * Orchestrates the reasoning process
 */
export class AgentPipeline {
  constructor() {
    this.intentAnalyzer = new IntentAnalyzer();
    this.scopeValidator = new ScopeValidator();
    this.planner = new Planner();
    this.toolExecutor = new ToolExecutor();
    this.evidenceSynthesizer = new EvidenceSynthesizer();
    this.responseComposer = new ResponseComposer();
  }

  async process(question, context = {}) {
    const state = new ReasoningState();
    
    // Step 1: Analyze intent
    state.update({ user_question: question });
    const intent = this.intentAnalyzer.analyze(question);
    state.update({ intent: intent.question_type });

    // Step 2: Validate scope
    const scopeValidation = this.scopeValidator.validate(question, intent);
    if (!scopeValidation.in_scope) {
      return {
        message: 'This question is outside the research scope. Please ask about paper content, methodology, or research findings.',
        reasoning: ['Scope validation failed'],
        confidence: null,
        sources: []
      };
    }

    if (scopeValidation.requires_clarification) {
      return {
        message: 'I need more context to answer this question. Please provide relevant papers or clarify your question.',
        reasoning: ['Clarification required'],
        confidence: null,
        sources: []
      };
    }

    // Step 3: Create plan
    const plan = this.planner.createPlan(intent, context);
    
    // Step 4: Execute plan
    const executionResult = await this.toolExecutor.execute(plan, state.get());
    state.update(executionResult.updated_state);

    // Step 5: Synthesize evidence
    const synthesis = this.evidenceSynthesizer.synthesize(
      executionResult.results,
      state.get()
    );
    state.update(synthesis);

    // Step 6: Compose response
    const response = this.responseComposer.compose(synthesis, state.get());

    return {
      message: response.message,
      reasoning: response.reasoning || [],
      confidence: response.confidence,
      sources: response.sources || []
    };
  }
}


