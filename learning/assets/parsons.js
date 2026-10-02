// Parsons problem: click lines in the pool to build the answer, click an
// answer line to return it. Markup contract: see HTML-ARTIFACTS.md.
(function () {
  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function setup(root) {
    // Several valid orders are separated by "|": data-answer="a b c | b a c".
    const answers = root.dataset.answer.split('|').map((order) => order.trim().split(/\s+/));
    const source = root.querySelector('ul');
    const lines = Array.from(source.querySelectorAll('li')).map((li) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'parsons-line';
      button.dataset.id = li.dataset.id;
      button.innerHTML = li.innerHTML;
      return button;
    });
    source.remove();

    const columns = document.createElement('div');
    columns.className = 'parsons-columns';
    const pool = document.createElement('div');
    pool.className = 'parsons-zone';
    pool.innerHTML = '<h4>Строки</h4>';
    const built = document.createElement('div');
    built.className = 'parsons-zone';
    built.innerHTML = '<h4>Твой порядок</h4>';
    columns.append(pool, built);

    const controls = document.createElement('div');
    controls.className = 'parsons-controls';
    const check = document.createElement('button');
    check.type = 'button';
    check.textContent = 'Проверить';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Сначала';
    controls.append(check, reset);

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.setAttribute('aria-live', 'polite');

    const why = root.querySelector('.parsons-why');
    root.insertBefore(columns, why);
    root.insertBefore(controls, why);
    root.insertBefore(feedback, why);

    function fill() {
      shuffle(lines).forEach((line) => pool.appendChild(line));
    }

    lines.forEach((line) => {
      line.addEventListener('click', () => {
        line.classList.remove('wrong');
        (line.parentElement === pool ? built : pool).appendChild(line);
      });
    });

    check.addEventListener('click', () => {
      const chosen = Array.from(built.querySelectorAll('.parsons-line'));
      chosen.forEach((line) => line.classList.remove('wrong'));
      const ids = chosen.map((line) => line.dataset.id);
      const solved = answers.some(
        (answer) => answer.length === ids.length && answer.every((id, i) => id === ids[i]),
      );
      if (solved) {
        root.classList.add('solved');
        feedback.textContent = 'Верно.';
        return;
      }
      const matched = (answer) => {
        const index = ids.findIndex((id, i) => id !== answer[i]);
        return index === -1 ? ids.length : index;
      };
      const firstWrong = Math.max(...answers.map(matched));
      if (firstWrong < ids.length) {
        chosen[firstWrong].classList.add('wrong');
        feedback.textContent = 'Строка ' + (firstWrong + 1) + ' не на месте или лишняя.';
      } else {
        feedback.textContent = 'Порядок верный, но не хватает строк.';
      }
    });

    reset.addEventListener('click', () => {
      root.classList.remove('solved');
      feedback.textContent = '';
      lines.forEach((line) => line.classList.remove('wrong'));
      fill();
    });

    fill();
  }

  document.querySelectorAll('.parsons').forEach(setup);
})();
