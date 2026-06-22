import { getGroq, groqModel } from "./groq";
import { EXPLAIN_SYSTEM } from "./prompts";
import { retrieve } from "@/lib/rag/retriever";
import type { AnomalyResult, ExplainResponse } from "@/types";

export async function explainAnomaly(check: AnomalyResult): Promise<ExplainResponse> {
  // 1. Short-circuit immediately if the check passed or has no anomalies
  if (check.status?.toUpperCase() === "PASS" || check.count === 0) {
    return {
      checkId: check.checkId,
      explanation: `**Status:** Successful Validation\n\nThe check **${check.checkName}** passed successfully. All manual calculations align perfectly with the expected records, confirming full data integrity. No anomalies or discrepancies were found.`,
      sources: [],
    };
  }

  // 2. Extract context via RAG for failed states
  const query = `${check.checkId} ${check.checkName} ${check.message}`;
  const context = await retrieve(query, 4);
  const contextText = context.map((c) => `[${c.source}]\n${c.text}`).join("\n\n---\n\n");

  // 3. Ground the specific row details so the LLM sees the precise failure context
  const sampleDetails = (check.details ?? [])
    .slice(0, 8)
    .map((d) => {
      const location = d.cellRef ?? `row ${d.rowIndex ?? "?"}`;
      const fieldInfo = d.field ? ` [Field: ${d.field}]` : "";
      return `- Location: ${location}${fieldInfo}\n  Observed Value: ${d.value ?? "(blank)"}\n  System Note: ${d.issue ?? "Mismatch detected."}`;
    })
    .join("\n");

  // 4. Construct the prompt with strict runtime truthfulness constraints
  const userPrompt = [
    "Authoritative rule context documentation:",
    contextText || "(none retrieved)",
    "",
    "Actual execution anomaly check result:",
    `ID: ${check.checkId}`,
    `Name: ${check.checkName}`,
    `Status: ${check.status}`,
    `Description: ${check.description}`,
    `Message: ${check.message}`,
    typeof check.count === "number" ? `Issues found: ${check.count}` : "",
    "",
    "Specific offending rows/cells parsed in this run:",
    sampleDetails || "(none)",
    "",
    "CRITICAL GROUNDING INSTRUCTIONS:",
    "1. Base your explanation strictly on the 'Actual execution anomaly check result' and 'Specific offending rows/cells' provided above.",
    "2. DO NOT assume or claim that outside sheets (such as 'Transaction_History') were cross-referenced or processed unless the 'Message' or 'Specific offending rows/cells' explicitly confirms their usage in this specific runtime error.",
    "3. If the mismatch is internal to a single sheet based on the description, limit your 'What this means' and 'How to fix' headers exclusively to reconciling that single sheet's calculation math.",
    "",
    "Explain this result following the required markdown sections.",
  ]
    .filter(Boolean)
    .join("\n");

  // 5. Execute LLM generation via Groq
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: groqModel(),
    temperature: 0.1, // Dropped to 0.1 to minimize creativity/hallucinations
    messages: [
      { role: "system", content: EXPLAIN_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const explanation =
    completion.choices[0]?.message?.content?.trim() || "No explanation was generated.";

  return {
    checkId: check.checkId,
    explanation,
    sources: [...new Set(context.map((c) => c.source))],
  };
}