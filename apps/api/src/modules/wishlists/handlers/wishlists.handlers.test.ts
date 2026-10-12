import { describe, it } from '@effect/vitest';

// TODO(you): задачи 3.2–3.5 (шаг 3.3), PostgreSQL HTTP-тесты (образец setup: auth/handlers/auth.me.test.ts).
describe('wishlists HTTP', () => {
  it.todo('Создание минимального Wishlist');
  it.todo('Ответ create соответствует записи');
  it.todo('Несколько Wishlist одного User');
  it.todo('Владелец не выбирается через query');
  it.todo('Владелец читает Private Wishlist');
  it.todo('Владелец читает Public Wishlist');
  it.todo('Другой User читает Public Wishlist');
  it.todo('Чтение старой Occasion Date');
  it.todo('Чужой Private Wishlist');
  it.todo('Отсутствующий Wishlist');
  it.todo('Одинаковое тело 404 для одного id');
  it.todo('Невалидное поле');
  it.todo('Клиент передаёт серверные поля');
  it.todo('Невалидный UUID');
  it.todo('Вчера минус один день отклоняется');
  it.todo('Пять лет плюс один день отклоняются');
  it.todo('Create без действующей Session');
  it.todo('Public Wishlist без действующей Session');
  it.todo('Временный отказ сохранения');
  it.todo('Повреждённая строка при read');
});
