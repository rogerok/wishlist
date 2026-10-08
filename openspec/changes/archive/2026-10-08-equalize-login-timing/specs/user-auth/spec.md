## ADDED Requirements

### Requirement: Проверка пароля при неизвестном email

Когда на `POST /api/auth/login` приходит email, для которого нет User или нет его Password Credential, API SHALL
выполнить одну проверку пароля той же стоимости, что и для зарегистрированного User, прежде чем ответить
`401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`. Так время ответа не показывает, зарегистрирован ли email.

#### Scenario: Неизвестный email

- **GIVEN** User с указанным email не зарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем, допустимыми для тела запроса
- **THEN** API выполняет ровно одну проверку пароля
- **AND** API отвечает `401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`

#### Scenario: User без Password Credential

- **GIVEN** User с указанным email зарегистрирован, и его Password Credential удалён из БД
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем, допустимыми для тела запроса
- **THEN** API выполняет ровно одну проверку пароля
- **AND** API отвечает `401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`
