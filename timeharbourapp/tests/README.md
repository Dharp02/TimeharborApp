# Playwright E2E Tests

End-to-end tests for the TimeHarbor app using [Playwright](https://playwright.dev/).

## Structure

```
tests/
├── e2e/              # Test specs (grouped by feature)
│   ├── auth.spec.ts
│   ├── auth-pages.spec.ts
│   └── dashboard.spec.ts
├── fixtures/         # Custom Playwright fixtures
│   └── auth.fixture.ts
├── helpers/          # Shared utilities and selectors
│   ├── selectors.ts
│   └── test-data.ts
└── pages/            # Page Object Model classes
    ├── base.page.ts
    └── dashboard.page.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run with browser visible
npm run test:headed

# Run in debug mode (step through)
npm run test:debug

# Run a single spec file
npx playwright test tests/e2e/auth.spec.ts

# Run only chromium
npx playwright test --project=chromium

# Open last HTML report
npm run test:report
```

## Adding New Tests

1. **Page Object** — add a new class in `pages/` extending `BasePage`
2. **Spec file** — create `tests/e2e/<feature>.spec.ts`
3. If the test needs an authenticated user, import from `fixtures/auth.fixture` and use the `authedPage` fixture
