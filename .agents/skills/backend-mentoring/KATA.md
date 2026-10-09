# Kata

Mode **practice**: the user implemented the pattern once or twice. The test is the specification; the user writes the implementation.

## Where

- **Project kata** (default): failing tests next to the real module in the project test style, plus a skeleton with typed stubs. The user turns them green; tests and implementation are committed together.
- **Standalone kata**: a drill outside the product (an Effect or SQL mechanism in isolation) in `apps/api/katas/NNNN-slug/`, with `README.md` (task, files to read first, run command; at most 10 lines), `*.kata.test.ts`, and the file the user edits. This directory sits outside `src`, the Vitest `include`, and the tsconfigs, so a red kata breaks no build, test run, or type check. The first standalone kata creates `apps/api/vitest.kata.config.ts` (the setup of `vitest.config.ts`, `include: ['katas/**/*.kata.test.ts']`) and a `kata` script.

## Writing the tests

- 3–7 tests, simplest first, ending with the case that carries the concept. Titles are behavior sentences in the style of the nearest existing test file.
- Use the nearest existing test as the template for setup, Layers, and matchers; name it for the user.
- Tests touch only the public interface.
- Run them before handing over and confirm each is red for its own reason: an assertion, not an import or type error.

## Test-writing ladder

The user is also learning to write tests. Record the current rung in `STATE.md`; move up after two successful katas on the current rung.

1. **Read**: the user predicts which test fails first and why.
2. **Fill**: one test has an empty assertion, `// TODO(you): expect(...)`; the user writes it.
3. **Scenarios**: the agent lists scenarios in plain words; the user writes the tests, the agent reviews them.

## Feedback

After each run, report which tests turned green. For a red test, give expected vs received and the line. After two failed attempts on one test: counterexample → pseudocode → that test's solution only.

Done when every test is green and lint passes on the touched files. Add one retrieval question about the kata's core to the review queue.
