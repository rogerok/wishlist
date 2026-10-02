# HTML artifacts

The user reads lessons in the browser. HTML is for anything longer than one chat screen or with a diagram or an exercise.

## Places

- `learning/lessons/NNNN-slug.html`: lessons and debriefs, one concept each, numbered in sequence.
- `learning/reference/*.html`: living reference updated in place. `system-map.html` is the big picture: layers, request flow, tables, files.
- `learning/assets/`: shared components. Every page links `learning.css`. Read this directory before writing a page and build from what exists; a second use of anything moves it here.

Open a finished page for the user with `xdg-open <file>`.

## Page anatomy

- Hero: eyebrow (`Урок · тема · N минут` or `Разбор · …`), `h1` states the claim being taught, lede states the goal in one sentence.
- Sections are `.card`, each short enough to read without scrolling back (segmenting).
- Code excerpts come from the real project and carry their `file:line`.
- At least one retrieval check: `.quiz` with answer options of equal length, a Parsons problem, `<details>` answers, or a small calculator when a number matters.
- One primary source link for the core claim.
- Footer: links to the system map, to the previous and next lesson, and the line «Вопросы — агенту в чате».

## Components

- **Diagrams** (`assets/diagrams.js`, Mermaid): a `<pre class="mermaid">` block, then at the end of `body`:

  ```html
  <script src="https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js"></script>
  <script src="../assets/diagrams.js"></script>
  ```

  `sequenceDiagram` for request flow, `stateDiagram-v2` for lifecycle, `erDiagram` for tables, `flowchart` for error mapping. Up to ~12 nodes per diagram; split larger ones. Labels in Russian, identifiers exactly as in code.

- **Parsons problem** (`assets/parsons.js`): shuffled code lines plus 1–2 plausible distractors; the user builds the order by clicking.

  ```html
  <div class="parsons" data-answer="a b c">
    <p>Задача одной фразой.</p>
    <ul>
      <li data-id="a"><code>…</code></li>
      <li data-id="x"><code>отвлекающая строка</code></li>
    </ul>
    <p class="parsons-why">Пояснение, показывается после верного ответа.</p>
  </div>
  <script src="../assets/parsons.js"></script>
  ```

- Charts with numbers (memory, latency): inline SVG, axes labelled with units.

Pages load as `file://`, so scripts are classic `<script src>`: browsers block local `type="module"` files there.

## Verify

Open the page in the browser tool when available. Diagrams render without «Syntax error», the Parsons check accepts the answer and rejects a distractor, links resolve.
