# Testing strategy

## Risk-based coverage

| Layer | Critical behavior | Coverage |
| --- | --- | --- |
| Unit | Input validation, pagination, score/XP calculations, response shaping | `tests/unit` |
| Integration | Catalogue API parameter handling, board validation, cache reads/writes, rate-limit boundary | `tests/integration` |
| End-to-end | Public entry points, client-side auth validation, protected dashboard redirect, authenticated logout | `tests/e2e` |

The next areas to add after the smoke suite are Supabase authentication success/failure flows using isolated test users, registration profile updates, dashboard data rendering, and the mock-test submission/scoring path.

## Commands

Run unit and integration tests:

```sh
npm test
```

Run coverage:

```sh
npm run test:coverage
```

Run browser smoke tests against an already-running, configured application:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The application requires valid Supabase environment variables before it starts. Do not use a production account for browser tests. The logout test is deliberately skipped because no logout behavior exists yet; it should be enabled only when a UI control or endpoint is added.
