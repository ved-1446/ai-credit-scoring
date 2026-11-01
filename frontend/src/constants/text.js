/**
 * text.js — Shared plain-language application terminology, descriptions, and disclaimers
 */

export const APP_NAME = "Data Dynamo";

export const TERMS = {
  probability: "risk score",
  threshold: "review cut-off",
  features: "main factors",
  disparateImpact: "gender flagged rate ratio",
};

export const DEMO_DISCLAIMER = "Educational demo. Not a real lending decision.";

export const RISK_BAND_DESCRIPTIONS = {
  LOW: "Minimal risk score under typical borrowing conditions.",
  MEDIUM: "Moderate risk profile with standard financial stability indicators.",
  HIGH: "Elevated risk score requiring closer evaluation.",
  VERY_HIGH: "Substantial risk indicator suggesting potential payment distress.",
};

// Validation default rates copied from the validation sample (LOW 2.84%, MEDIUM 7.56%, HIGH 18.28%, VERY HIGH 30.88%)
export const VALIDATION_BAND_DEFAULT_RATES = {
  LOW: "2.84%",
  MEDIUM: "7.56%",
  HIGH: "18.28%",
  VERY_HIGH: "30.88%",
};

export const SENSITIVE_INPUTS_NOTE =
  "This demo model also uses gender and age as inputs. See the fairness page for how this is monitored.";

export const CHAT_PRIVACY_NOTICE =
  "Your question is sent to Google's Gemini to write the answer. Do not type names, ID numbers or other personal details. This app does not save your chat.";

export const LAB_SAVING_NOTICE =
  "Lab runs are saved like normal predictions under the admin account and count in the statistics.";

export const SUGGESTED_CHAT_QUESTIONS = [
  "What does my risk score mean?",
  "What are external credit scores?",
  "How is the review cut-off decided?",
  "Why is demographic information tracked?",
];

