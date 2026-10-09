# Spec Delta

## MODIFIED Requirements

### Requirement: Ответ на временную недоступность

Если обработка запроса завершилась временной недоступностью ресурса, после которой повтор запроса может пройти, API
SHALL отвечать `503 Service Unavailable` с типом содержимого `application/problem+json` и телом, содержащим
`code: SERVICE_UNAVAILABLE`, `status: 503` и `instance`, равный пути запроса.

#### Scenario: Перегрузка расчёта хеша пароля при signup

- **GIVEN** все слоты расчёта хеша пароля заняты
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `503 Service Unavailable` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: SERVICE_UNAVAILABLE`, `status: 503`, `instance: /api/auth/signup`

#### Scenario: PostgreSQL недоступна до запроса

- **GIVEN** у User есть действующая Session, и клиент передаёт её cookie `wishlist_session`
- **AND** соединения API с PostgreSQL оборваны до запроса, и новые соединения не устанавливаются
- **WHEN** клиент отправляет `GET /api/auth/me` с этой cookie
- **THEN** API отвечает `503 Service Unavailable` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: SERVICE_UNAVAILABLE`, `status: 503`, `instance: /api/auth/me`
