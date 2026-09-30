# REPL

REPL — интерактивная консоль Node.js, в которой можно вызывать сервисы приложения напрямую, без HTTP.

```bash
pnpm --filter @wishlist/api repl
```

```text
@wishlist/api> await health.get()
{ status: 'OK' }
@wishlist/api> await users.getById('00000000-0000-4000-8000-000000000000')
Uncaught UserNotFoundError ...
```

## Как это устроено

```text
bin/repl.ts          собирает AppServicesLive один раз, запускает REPL,
                     кладёт в него объекты из makeReplContext
      ↓
repl-context.ts      список объектов, доступных в консоли: health, users, ...
      ↓
makeReplFacade       Effect-методы → функции, возвращающие Promise
      ↓
modules/*/repl       что показать из модуля и как проверить аргументы (decodeArgs)
      ↓
Service              обычный сервис модуля, ничего не знает про REPL
```

Модуль описывает только **что** доступно и **как проверять вход**. Запуск эффектов и превращение их в `Promise`
делает инфраструктура.

## `decodeArgs`

### Зачем

Сервисы принимают уже проверенные данные. Например, `UsersService.getById` ждёт `UserId` — branded-тип (строка с
«печатью», что это валидный UUID). В REPL мы вводим обычную строку `'...'`. Её нужно прогнать через ту же Schema,
что и на HTTP-границе, иначе в сервис попадёт мусор, а TypeScript этого не заметит: в рантайме типов нет.

Без хелпера каждый метод выглядел бы так:

```ts
const getById = (id: string) =>
  Effect.gen(function* () {
    const userId = yield* Schema.decodeEffect(UserIdSchema)(id);
    return yield* usersService.getById(userId);
  });
```

`decodeArgs` делает то же самое, но для любого числа аргументов:

```ts
getById: decodeArgs([UserIdSchema], users.getById),
update: decodeArgs([UserIdSchema, UpdateUserBodySchema], users.update),
```

### Что происходит при вызове

Возьмём `update` и вызов `users.update('0000...', { firstName: 'Ann' })`.

1. **При создании** `decodeArgs` склеивает список схем в одну схему кортежа (tuple — массив фиксированной длины,
   где у каждой позиции свой тип):

   ```ts
   Schema.Tuple([UserIdSchema, UpdateUserBodySchema]);
   ```

2. **При вызове** все аргументы собираются в массив `args` — `['0000...', { firstName: 'Ann' }]` — и декодируются
   этой схемой за один раз. Позиция 0 проверяется `UserIdSchema`, позиция 1 — `UpdateUserBodySchema`.

3. Если декодирование прошло, получается массив уже проверенных значений `[UserId, UpdateUserBody]`, и он
   раскладывается в аргументы исходной функции: `fn(...decoded)`, то есть `users.update(userId, body)`.

4. Если нет — эффект падает с `SchemaError`, и сервис не вызывается.

Код целиком:

```ts
export const decodeArgs = <Schemas, A, E>(schemas, fn) => {
  const decode = Schema.decodeEffect(Schema.Tuple(schemas)); // шаг 1

  return (
    ...args // шаг 2: args — массив аргументов
  ) =>
    decode(args).pipe(
      Effect.flatMap((decoded) => fn(...decoded)), // шаг 3
    );
};
```

### Что проверяется

Кортеж строгий: проверяется не только тип каждой позиции, но и количество аргументов.

| Вызов                    | Результат                                         |
| ------------------------ | ------------------------------------------------- |
| `getById('<uuid v4>')`   | вызывается `users.getById`                        |
| `getById('bad')`         | `SchemaError: Expected a UUID v4 at [0]`          |
| `getById()`              | `SchemaError: Missing key at [0]`                 |
| `getById('<uuid>', 'x')` | `SchemaError: Expected no excess property at [1]` |

`[0]`, `[1]` в ошибке — номер аргумента.

### Как выводятся типы

У каждой схемы два типа:

- `Encoded` — что приходит снаружи (для `UserIdSchema` — `string`);
- `Type` — что получается после декодирования (`UserId`).

`decodeArgs` использует их так:

```ts
fn: (...args: Schema.Tuple.Type<Schemas>) => ...     // fn принимает проверенные типы
return (...args: Schema.Tuple.Encoded<Schemas>) => ...// наружу торчат «сырые» типы
```

Отсюда две проверки на этапе компиляции:

- если порядок схем не совпадает с параметрами сервиса (`decodeArgs([UpdateUserBodySchema, UserIdSchema],
users.update)`), TypeScript выдаст ошибку — `Type` схем не подходит под параметры `fn`;
- результирующая функция принимает `string` и тело запроса в формате `Encoded`, как в HTTP.

`const Schemas` в дженерике нужен, чтобы `[UserIdSchema, UpdateUserBodySchema]` вывелся как кортеж из двух
конкретных схем, а не как «массив каких-то схем» — иначе типы позиций бы потерялись.

Ограничение `Schema.ConstraintDecoder<unknown>` означает «схема, которой для декодирования не нужны сервисы».
Если схеме понадобится сервис, `decodeArgs` не скомпилируется — это сделано намеренно, чтобы не протаскивать
зависимости в REPL.

### Ограничения

- Каждый аргумент должен иметь схему. Если аргумент проверять не нужно, всё равно передай для него схему
  (например, `Schema.Boolean`).
- Функции без аргументов и Effect-значения (как `users.getAll`) оборачивать не нужно — отдавай их как есть.

## `makeReplFacade`

Принимает объект, где каждое поле — либо функция, возвращающая `Effect`, либо сам `Effect`, и возвращает объект
с теми же ключами, где всё превращено в функции, возвращающие `Promise`:

| В модуле                                | В консоли                            |
| --------------------------------------- | ------------------------------------ |
| `getAll: Effect<User[]>`                | `getAll(): Promise<User[]>`          |
| `getById: (id: string) => Effect<User>` | `getById(id: string): Promise<User>` |

Эффекты запускаются через `Effect.runPromiseWith(context)` с контекстом, в котором был создан фасад, — то есть
с уже собранными слоями приложения. Упавший эффект превращается в отклонённый `Promise` с исходной ошибкой
(`UserNotFoundError`, `SchemaError`), поэтому в консоли видно конкретную причину.

Внутри есть одно приведение типа (`as ReplFacade<Members>`): `Object.fromEntries` не умеет сохранять связь
«ключ → сигнатура». Остальной код типобезопасен.

## Как добавить модуль

1. Создай `modules/<name>/repl/<name>.repl.ts`:

   ```ts
   export const SessionsRepl = Effect.gen(function* () {
     const sessions = yield* SessionsService;

     return {
       getAll: sessions.getAll,
       revoke: decodeArgs([SessionIdSchema], sessions.revoke),
     };
   });
   ```

   Если у сервиса нет аргументов, которые надо проверять, файл не нужен — переходи к шагу 2 с самим сервисом.

2. Добавь его в `repl-context.ts`:

   ```ts
   sessions: yield* makeReplFacade(yield* SessionsRepl),
   ```

3. Убедись, что слой сервиса входит в `AppServicesLive` (`src/app.ts`).
