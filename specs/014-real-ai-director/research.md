# Research Decisions

1. Use exact model ID `gpt-5.6-terra` for both external profiles and preserve returned model facts.
2. Use Responses structured output and one request per attempt. CodexManager accepts JSON and SSE;
   official OpenAI uses the repository's direct Responses adapter.
3. Keep price facts in a timestamped server registry; stale or absent data disables external preview.
4. Stable shot keys are derived from canonical output hash plus ordinal.
5. Recommend scene, character, primary product/prop, appearance component, then stable semantic order;
   never infer semantics from filename or path.
