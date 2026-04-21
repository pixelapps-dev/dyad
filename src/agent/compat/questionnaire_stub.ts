/**
 * Stub for the planning questionnaire resolver. The original lived in the
 * FSL-licensed tool_definitions. Re-implement as a real tool under
 * src/agent/tools/ when you wire up plan-mode.
 */
export async function resolveQuestionnaireResponse(
  _args: unknown,
): Promise<void> {
  throw new Error(
    "Planning questionnaire is not implemented in this fork. See FORK.md.",
  );
}
