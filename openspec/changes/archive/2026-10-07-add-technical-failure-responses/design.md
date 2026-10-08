# Design

Решение и отвергнутые варианты описаны в
[ADR-0005](../../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md). Здесь — только расположение кода.

- `infra/logging/error-chain.ts` — `describeErrorChain`: обход `cause` с копированием `_tag` и строкового `operation`.
- `infra/errors/technical-http-errors.ts` — `InternalHttpError`, `ServiceUnavailableHttpError` и `technicalHttpErrors`
  для контрактов эндпоинтов.
- `infra/errors/technical-failure.ts` — `makeTechnicalFailureHandler`: модуль задаёт имя, свои операции и отображение
  тегов ошибок сервиса в причину (`internal`, `dataIntegrity`, `unavailable`); хелпер пишет одну строку
  `operation.failed` и возвращает ошибку `500` или `503`. `infra` не импортирует модули.
- Сервисы и репозитории не меняются: классификация «повторяемый сбой → unavailable» остаётся в `auth.service.ts` и
  `users.service.ts`.
