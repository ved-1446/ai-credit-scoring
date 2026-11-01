/**
 * chatTopics.js — Page-specific suggested topics and questions mapping to backend help note IDs.
 */

export const ROUTE_TOPICS = {
  Consent: [
    { text: "How is my privacy and consent protected?", topic: "privacy_and_consent" },
    { text: "What is this educational demo disclaimer?", topic: "educational_demo_disclaimer" },
  ],
  Apply: [
    { text: "What happens if I leave optional fields blank?", topic: "optional_fields_blank" },
    { text: "What are external credit scores 1, 2, and 3?", topic: "external_credit_scores" },
    { text: "How do credit report inquiries affect scoring?", topic: "credit_report_checks" },
    { text: "How do income and loan amount affect default risk?", topic: "income_and_loan" },
    { text: "How are employment history and age evaluated?", topic: "employment_and_age" },
    { text: "How do family status and housing affect the result?", topic: "family_and_home" },
  ],
  History: [
    { text: "How do I interpret my evaluation history?", topic: "history_page" },
    { text: "What does the default risk percentage mean?", topic: "percentage_meaning" },
  ],
  Result: [
    { text: "How do AI explanations work?", topic: "how_explanations_work" },
    { text: "Why did specific factors raise or lower my risk?", topic: "reasons_raised_lowered" },
    { text: "What do the four risk levels mean?", topic: "risk_levels" },
    { text: "How does the what-if simulation work?", topic: "result_page_and_whatif" },
    { text: "What should I do if I disagree with the result?", topic: "disagree_with_result" },
    { text: "How are fairness and demographic factors handled?", topic: "fairness_and_gender" },
    { text: "What are the model limits and boundaries?", topic: "model_limits_and_honesty" },
  ],
  Reliability: [
    { text: "What are the model limits and boundaries?", topic: "model_limits_and_honesty" },
    { text: "What does the default risk percentage mean?", topic: "percentage_meaning" },
  ],
  Admin: [
    { text: "How are technical statistical terms defined?", topic: "technical_terms_explained" },
    { text: "What are the model's technical architecture details?", topic: "model_technical_details" },
    { text: "How does the machine learning scoring pipeline work?", topic: "scoring_mechanics" },
  ],
};
