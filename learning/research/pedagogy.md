# Педагогические приёмы: что доказано и что из этого следует

Обоснование навыка `backend-mentoring`. Проверено 2026-10-02 по первоисточникам и обзорам.

## Выводы для фреймворка

| Приём                                                                                     | Доказательство                                                                                                                                          | Решение в навыке                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Проверка вспоминанием (practice testing) и интервальное повторение (distributed practice) | Единственные две техники с оценкой «высокая полезность» из десяти в обзоре Dunlosky et al. (2013). Перечитывание и выделение — «низкая».                | Очередь повторения с коробками Лейтнера. Урок без вопросов на вспоминание считается незаконченным. |
| Разобранный пример (worked example) и постепенное убирание шагов (fading)                 | Новичкам полный пример помогает больше, чем самостоятельный поиск. Постепенный переход лучше резкого (Renkl, Atkinson).                                 | Режим **new**: полный пример → пример с пропусками → свой вариант.                                 |
| Эффект обратной экспертизы (expertise reversal)                                           | Приём, полезный новичку, мешает тому, кто тему уже знает (Kalyuga et al., 2003).                                                                        | Режим выбирается по уровню владения конкретным паттерном, не по человеку в целом.                  |
| Метки подцелей (subgoal labels)                                                           | Названия групп шагов в примере улучшают решение новых задач и снижают отсев (Margulieux, Morrison).                                                     | Пример размечается 3–5 подцелями вместо построчных комментариев.                                   |
| Задачи Парсонса (Parsons problems)                                                        | Собрать код из перемешанных строк с лишними строками-ловушками быстрее, чем написать или исправить, а результат обучения тот же (Ericson et al., 2017). | Дешёвое упражнение в HTML-уроках, подходит без IDE.                                                |
| PRIMM: предскажи → запусти → исследуй → измени → напиши                                   | Статистически значимое улучшение результатов в 13 школах (Sentance et al., 2019). Новичок сначала читает код, потом пишет.                              | Вопрос «что выведет?» задаётся только после показанного кода.                                      |
| Мультимедийные принципы Mayer                                                             | Убрать лишнее (coherence): d ≈ 0.70–0.86. Подписи рядом с картинкой (spatial contiguity): d ≈ 0.79–1.10. Короткие сегменты (segmenting): d ≈ 0.70.      | Стайлгайд против «слопа»; подписи прямо на диаграммах; уроки по шагам.                             |
| Постепенная абстракция (concreteness fading)                                              | Конкретное → схема → абстрактный символ помогает переносу знаний (Fyfe et al., 2014).                                                                   | Порядок объяснения: реальный код и значения → диаграмма → название концепции.                      |

## Риск AI-помощи при обучении

- **Anthropic, Shen & Tamkin (2026).** 52 разработчика осваивали новую библиотеку. С AI-ассистентом результат теста на понимание был на 17% ниже (50% против 67%). Сильнее всего просела отладка. Те, кто отдавал AI написание кода, набрали меньше 40%. Те, кто задавал концептуальные вопросы, — 65% и больше. Ускорение статистически незначимо. Авторы ожидают, что с агентными инструментами эффект будет сильнее.
- **Bastani et al. (PNAS, 2025).** Около 1000 школьников. Обычный GPT-4 ухудшил результат экзамена без AI на 17%. Тьютор с ограничениями («не выдавать готовое решение») этот вред убрал.

**Следствие.** Режим, в котором агент пишет код (**routine**), допустим только для паттерна, который ты уже реализовал сам. После него обязателен разбор с вопросами. Отладку тренировать отдельно.

## ASD-STE100 и идеи Карпатого

- **ASD-STE100** — стандарт контролируемого английского для авиационной документации. Issue 9 (2025): 53 правила. Предложение в инструкции — до 20 слов, в описании — до 25. Абзац — до 6 предложений. Одна инструкция на предложение. Действительный залог. Одно слово — одно значение. Сокращать предложение, выбрасывая подлежащее или сказуемое, запрещено. Словарь английский, поэтому для русского текста берём структурные правила, а словарь не берём.
- **Карпатый** предлагает выбирать форму ответа под задачу: контролируемый язык, диаграмма, интерактивная HTML-страница, одноразовое объясняющее видео. Сам пост в X я не открывал: X требует входа. Опираюсь на пересказ.
- **Видео в стиле 3Blue1Brown** (Manim и озвучка) дорого делать и проверять. Для потока запроса через слои ту же задачу дешевле решает HTML-диаграмма с пошаговым проходом. Видео отложено до темы, где важна непрерывная анимация.

## Источники

- Dunlosky et al. (2013). [Improving Students' Learning With Effective Learning Techniques](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html). _Psychological Science in the Public Interest_, 14(1).
- Kalyuga, Ayres, Chandler, Sweller (2003). [The Expertise Reversal Effect](https://www.researchgate.net/publication/48829036_The_Expertise_Reversal_Effect). _Educational Psychologist_, 38(1).
- Renkl, Atkinson, Große (2004). [How Fading Worked Solution Steps Works](https://link.springer.com/article/10.1023/B:TRUC.0000021815.74806.f6). _Instructional Science_, 32.
- Margulieux, Catrambone, Guzdial (2016). [Employing subgoals in computer programming education](https://bpb-us-e1.wpmucdn.com/sites.gatech.edu/dist/b/1555/files/2020/09/MargulieuxCatramboneGuzdial2016.pdf); список работ — [cs1subgoals.org](https://www.cs1subgoals.org/publications/).
- Ericson, Margulieux, Rick (2017). [Solving Parsons Problems Versus Fixing and Writing Code](http://faculty.chas.uni.edu/~schafer/cohort23/Methods/ReadingsBackups/mod2/ParsonsProblems.pdf). Koli Calling.
- Sentance, Waite, Kallia (2019). [Teaching computer programming with PRIMM](https://www.tandfonline.com/doi/full/10.1080/08993408.2019.1608781). _Computer Science Education_, 29(2–3).
- Mayer (2017). [Using multimedia for e-learning](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12197). _Journal of Computer Assisted Learning_.
- Fyfe, McNeil, Son, Goldstone (2014). [Concreteness Fading in Mathematics and Science Instruction](https://link.springer.com/article/10.1007/s10648-014-9249-3). _Educational Psychology Review_, 26.
- Shen, Tamkin (2026). [How AI Impacts Skill Formation](https://arxiv.org/pdf/2601.20245). arXiv:2601.20245.
- Bastani et al. (2025). [Generative AI without guardrails can harm learning](https://doi.org/10.1073/pnas.2422633122). _PNAS_, 122(26).
- [Simplified Technical English](https://en.wikipedia.org/wiki/Simplified_Technical_English) — обзор стандарта; [TechScribe: ASD-STE100](https://www.techscribe.co.uk/techw/asd-simplified-technical-english.htm).
