# Contributing

Thank you for your interest in contributing to the FDE Discovery Tool. This document outlines the guidelines and workflow for contributing.

## Development Setup

See the [README](README.md) for environment setup instructions.

## Branching Strategy

- `main` -- production-ready code
- `feature/<phase>-<name>` -- feature branches (e.g., `feature/phase-1-database`)

Create feature branches from `main` and open a pull request when ready for review.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope:

```
feat(clients): add client creation form
test(clients): add client creation API tests
fix(sessions): handle empty transcript in synthesis
chore(db): add notes column to sessions migration
```

**Types:** `feat`, `fix`, `test`, `chore`, `refactor`, `docs`, `style`
**Scopes:** `clients`, `processes`, `sessions`, `db`, `ai`, `auth`, `settings`, `layout`

## Code Style

- **Files:** kebab-case (`client-form.tsx`)
- **Components:** PascalCase (`ClientForm`)
- **Functions:** camelCase (`getClientById`)
- **TypeScript:** Strict mode enabled. No `any` types unless unavoidable.
- **Imports:** Use `@/` path alias for `src/` directory imports.

## Testing

We follow a **test-first workflow**:

1. Write the test describing expected behavior
2. Run it and confirm it **fails (RED)**
3. Implement the minimum code to make it pass (GREEN)
4. Run the full test suite
5. Refactor if needed

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Type checking
npm run type-check
```

All pull requests must pass the existing test suite and include tests for new functionality.

## Architecture Rules

These rules are non-negotiable:

- **No raw SQL** -- use Drizzle query functions in `lib/db/queries/`
- **No Supabase client for data queries** -- Supabase is used for file storage only
- **No server-side `ANTHROPIC_API_KEY`** -- all AI calls use the user's key from Clerk `privateMetadata`
- **`await params`** in dynamic routes -- Next.js 15+ requires this
- **`requireAdmin()`** on write routes, **`requireAuth()`** on read routes
- **`handleAPIError(error)`** in every API catch block -- never return raw errors

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run `npm run test:run` and `npm run type-check` before pushing
3. Write a clear PR description explaining what changed and why
4. Link any related issues
5. Request a review

## API Route Pattern

All API routes must follow this structure:

```typescript
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await createSomething(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

## Reporting Issues

Open a GitHub issue with:

- A clear title and description
- Steps to reproduce (if applicable)
- Expected vs. actual behavior
- Screenshots or logs if relevant
