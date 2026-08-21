# REPL and server entry points

## Status

Implementation slices 1–12 are complete. The HTTP server and interactive REPL have separate executable entry points,
share `AppServicesLive`, and preserve one resource-safe runtime lifecycle per process. The REPL exposes every
`UsersService` operation through a Schema-validating Promise facade.

The learner writes all production code and tests. The mentor:

- asks guiding questions and explains the relevant model;
- inspects the repository and installed library APIs instead of guessing;
- reviews each small change and runs the narrowest relevant check;
- strengthens a hint only when the previous level was insufficient;
- writes implementation code only after an explicit request.

## Goal

Create two application entry points:

- `apps/api/src/bin/server.ts` starts the HTTP application;
- `apps/api/src/bin/repl.ts` starts an interactive Node.js REPL without starting the HTTP server.

The REPL exposes a Promise-based `users` facade so application use cases can be explored interactively, for example:

```text
await users.getAll()
await users.getById("550e8400-e29b-41d4-a716-446655440000")
```

The current domain uses UUID user identifiers. The mentor's illustrative `UserService.getById(db, 1)` call must not be
copied literally: the current service is `UsersService`, its database dependency is supplied through Effect layers, and
`UserId` is a branded UUID.

## Decisions

### Learning workflow

Work in small vertical slices. The learner implements each slice; the mentor reviews it before the next slice. Do not
paste a complete solution upfront.

### File layout

Keep executable TypeScript files under the existing `apps/api/src/bin/` convention alongside `migrate.ts`.

After every caller and package script has moved to `src/bin/server.ts`, remove obsolete `src/main.ts`. Do not keep two
server entry-point conventions.

### Dependency composition

Extract one shared application-services layer for the dependencies required by both entry points:

- `PgClientLive`;
- `DBLive`;
- `UsersModuleLive`.

The server composes the shared services with `HttpLive`. The REPL composes only the shared services and must not bind an
HTTP port.

Do not introduce a separate dependency-injection container. Effect `Layer` and `Context` already perform that role.

### Effect integration

Use APIs from the installed `effect@4.0.0-rc.108` and `@effect/platform-node@4.0.0-rc.108`. Inspect their source,
declarations, or current documentation before choosing an unstable or release-candidate API.

Expected responsibilities:

- `NodeRuntime.runMain` runs the server program;
- `ManagedRuntime` builds the REPL service layer once, runs many Effects through `runPromise`, and releases layer-scoped
  resources through `dispose`;
- existing Schema values validate data entered at the REPL boundary.

The project does not currently depend on `@effect/cli`. Do not add it speculatively. `node:repl` provides the JavaScript
evaluation loop; Effect provides application runtime, services, validation, errors, and resource safety. Reconsider
Effect CLI/platform functionality only when it removes a concrete piece of required behavior.

### REPL facade

Expose only a `users` facade, not the database, repository, raw Effect runtime, or HTTP server.

All operations have a uniform method shape and return Promises:

- `users.create(input)`;
- `users.getAll()`;
- `users.getById(id)`;
- `users.update(id, input)`;
- `users.deleteById(id)`.

The facade accepts ordinary JavaScript strings and objects. It decodes them with the existing `UserIdSchema`,
`CreateUserBodySchema`, and `UpdateUserBodySchema` before invoking `UsersService`.

Validation and domain failures reject the Promise with their original errors. Do not convert failures to `undefined` or
display-only strings.

### Scaling to more modules

Keep the first facade local to `src/bin/repl.ts` while users are the only application module. Do not introduce a
registry, generic CRUD generator, or mapped-type wrapper from one example.

When a second module needs REPL access, move each adapter next to its feature, for example
`src/modules/users/repl/users.repl.ts` and `src/modules/wishlists/repl/wishlists.repl.ts`. Add a small
`src/repl/repl-context.ts` composition module that creates the top-level `{ users, wishlists }` object. At that point
`src/bin/repl.ts` should own only runtime acquisition, REPL startup, context attachment, exit waiting, and cleanup.

Keep Schema decoding and service invocation explicit inside each feature adapter: those operations express real boundary
behavior and differ by use case. Extract a shared runner helper only after at least two adapters demonstrate the same
shape and the helper preserves inference without `any` or assertions. Do not generate the direct-service REPL from
`HttpApi`; HTTP and REPL are separate adapters over the same use cases.

### Lifecycle

Initialize the Effect runtime and facade before accepting REPL input. The user must never observe a partially
initialized `r.context`.

Dispose the managed runtime when the REPL exits so PostgreSQL resources do not keep the process alive. Cover normal
`.exit` and `Ctrl+D`; account for process termination without registering competing cleanup paths that can dispose the
runtime more than once.

### Launching

Provide package scripts as the primary reproducible interface. Preserve the mentor example's direct-execution intent as
well: source entry points should have a shebang compatible with this repository's `tsx`, `development` import condition,
and development environment loading. Do not copy `#!/usr/bin/env -S node` blindly because the source import mapping is
not the compiled import mapping.

## Implementation slices

1. Identify the service-layer graph currently assembled in `src/main.ts`.
2. Extract the shared application-services layer without changing behavior.
3. Move HTTP startup into `src/bin/server.ts` and update every package script/caller.
4. Start the real HTTP application and confirm its existing health behavior.
5. Define the typed Promise facade contract without implementing every operation.
6. Implement `users.getById(rawId)` as the first end-to-end REPL operation.
7. Check a malformed UUID and an existing UUID through the same facade.
8. Add `create`, `getAll`, `update`, and `deleteById` by following the established pattern.
9. Start `node:repl` only after the managed runtime and facade are ready.
10. Connect REPL exit to managed-runtime disposal.
11. Add package scripts and the verified direct-execution shebang.
12. Exercise the actual REPL and perform a final code review.

## Verification contract

Use the narrowest check after each slice. Final verification must include:

```bash
pnpm --filter @wishlist/api check-types
```

Run the real HTTP entry point and observe that the existing health endpoint still responds.

With the development PostgreSQL instance available, run the real REPL and exercise:

```text
await users.getAll()
await users.getById("<existing UUID>")
await users.getById("not-a-uuid")
.exit
```

Confirm that:

- commands cannot run before initialization finishes;
- valid operations return their service results;
- malformed input fails at Schema validation;
- service failures remain observable;
- the REPL process exits and releases database resources;
- the REPL never starts the HTTP server.

Do not add tests that merely assert imports, object plumbing, or source text. Add a behavioral test only when a new
observable contract cannot be proved reliably by the real smoke scenario.

## Resume point

Implementation and review are complete. `pnpm --filter @wishlist/api check-types`,
`pnpm --filter @wishlist/api lint`, and `pnpm --filter @wishlist/api build` pass. Both source entry points are executable.
Direct `src/bin/server.ts` returned `{"status":"OK"}` from `GET /health`; direct `src/bin/repl.ts` returned the retained
user from `users.getById(...)` and exited with code 0. The package `repl` script, custom prompt, history persistence across
two sessions, `SchemaError`, `UserNotFoundError`, `create → getAll → getById`, and `update → getById` were also verified.

`deleteById` is implemented and statically checked, but its destructive runtime scenario was intentionally skipped. The
retained development record is `repl-user@example.com`, UUID `04ebc03d-0391-47cd-a584-694d8b2a97df`, with
`firstName: "Updated"`. No additional implementation step remains.

## Users REPL module extension

The module-extraction portion is implemented; fake-data helpers remain pending. The users-specific REPL contract, Schema
decoding, and Promise facade live in `src/modules/users/repl/users.repl.ts`. Runtime acquisition, Node REPL startup,
context attachment, history, exit waiting, and cleanup remain in `src/bin/repl.ts`.

Each feature factory uses Effect DI rather than accepting its domain service as a plain argument.
`makeUsersRepl(runPromise)` returns an Effect whose requirement is `UsersService`; it obtains the service with
`yield* UsersService` and captures it once in the facade methods. `makeReplContext(runPromise)` composes all feature
factory Effects, so its requirement type grows as new modules are added.

The entry point obtains the cached application Context through `runtime.contextEffect` and supplies that Context to
`makeReplContext` with `Effect.provide`. It must not provide `AppServicesLive` a second time. The Promise runner remains
an explicit minimal callback derived from the owning `ManagedRuntime`; do not turn it into a Context service and create a
runtime lifecycle cycle.

`src/repl/repl-context.ts` now owns the typed top-level `ReplContext`; the entry point attaches the complete object with
`Object.assign`, so future namespaces do not require entry-point changes. `RunPromise` is a shared type-only contract in
`src/repl/repl.types.ts`. The Node ESLint configuration enforces `@typescript-eslint/consistent-type-imports` and can
autofix violations with `eslint --fix`.

`check-types`, `lint`, and `build` pass. The real REPL exposes all five users methods through the assembled context,
returns the retained user from `getById`, and exits with code 0.

Use Node REPL's standard property completion for methods and namespaces; do not build a custom parser for argument fields
or database identifiers. Preserve the explicit `users.create(data)` and `users.update(id, data)` operations and add a
separate `users.fake` namespace:

```text
users.fake.create(overrides?)
users.fake.update(id, overrides?)
```

Fake helpers may generate unique fictitious values with the standard library and accept overrides, but their merged
inputs must still pass through the existing create/update Schema decoders. Do not add a faker dependency for this small
contract. `fake.update` requires an explicit user id and must not select an arbitrary database row.
