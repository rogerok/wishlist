# Worked example → faded example

Mode **new**: the user has not implemented this pattern yet. Working memory is the constraint, so show the whole solution first and hand it over in steps.

1. **Worked example.** Write a complete, runnable example of the pattern on a task adjacent to the project task: same mechanism, different details. When the project already contains the pattern (signup for login), use that code as the example. Split it into 3–5 **subgoals**: a short label naming what a group of lines achieves («Получить зависимости», «Посчитать hash вне транзакции»). Labels are comments above each group, one line each. Run it and show the output.
   Done when the example runs and every subgoal maps to one sentence of explanation.
   Where: up to ~40 lines and no diagram → chat; otherwise an HTML lesson ([HTML-ARTIFACTS.md](HTML-ARTIFACTS.md)) with the diagram beside the code.
2. **Predict.** One question: change one visible thing in the example — what happens? Then run it and show the result. Skip when nothing non-trivial is predictable.
3. **Faded example.** Write the project code with 1–3 gaps. Each gap is the core of the pattern; everything around it is complete and type-checks. A gap is a body of `Effect.die('TODO(you): <что и зачем>')` or an equivalent typed stub, so the code compiles and the check fails meaningfully. Keep the subgoal labels from step 1 above the gaps.
   Provide the check: an existing or new test that turns green when the gaps are right. Run it and confirm it is red for the right reason.
4. **User fills the gaps.** On each attempt name the correct part and the exact mismatch. After two failed attempts on one gap, show that gap's solution with its explanation; the other gaps stay with the user.
5. **Close.** Run the check green. Add 2–3 retrieval questions to the review queue ([DEBRIEF.md](DEBRIEF.md#review-queue)). Set the pattern's mastery to 2 if it was lower.

A **Parsons problem** may replace step 3 when the user is away from the IDE: the gap's lines are shuffled with 1–2 plausible distractor lines, and the user orders them in an HTML lesson.
