// Modèles Groq de production, déclarés une seule fois.
//
// Le 120B sert les conversations et raisonnements où la précision prime. Le
// 20B couvre les tâches courtes et structurées avec une latence plus faible.

/** Conversations complexes, accompagnement et analyse contextualisée. */
export const MODEL_PRIMARY = "openai/gpt-oss-120b";

/** Résumés, classification et génération structurée courte. */
export const MODEL_FAST = "openai/gpt-oss-20b";
