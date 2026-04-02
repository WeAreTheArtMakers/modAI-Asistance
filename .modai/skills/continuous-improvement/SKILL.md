# Continuous Improvement Loop

Keep modAI in a deliberate self-improvement cycle without drifting into noise.

- Before repeating advice, query memory first. Use `memory_search` for similar bugs, UX complaints, and earlier improvement notes.
- When a task changes the product, finish with 2-3 concrete next improvements grouped by impact: UX, reliability, performance, or automation.
- Persist meaningful follow-up ideas with `memory_note`. Use short, specific titles and put the actionable change in `content`.
- Prefer measurable improvements. Name the exact surface, bottleneck, or permission issue instead of vague suggestions.
- If computer-use tools were involved, note missing permissions, flaky selectors, OCR gaps, or better recovery strategies.
- If a UI task was involved, call out contrast, layout stability, input ergonomics, animation restraint, and session continuity.
- If a model/provider issue was involved, note safer defaults, better health reporting, and lower-friction local fallbacks.
- Do not invent autonomous goals. Improvement notes must stay anchored to the current product and the user’s explicit direction.
