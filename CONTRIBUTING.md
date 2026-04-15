# Contributing to Traza Frontend

Welcome! This guide will help you understand our development practices and coding standards.

> **Philosophy**: We prioritize shipping fast while maintaining code quality. These guidelines ensure our team remains efficient and our codebase stays maintainable.

## Table of Contents

- [General Principles](#general-principles)
- [Project Structure](#project-structure)
- [Module Architecture](#module-architecture)
- [API Services](#api-services)
- [Data Fetching](#data-fetching)
- [Error Handling](#error-handling)
- [React Hooks & Patterns](#react-hooks--patterns)
- [React Best Practices](#react-best-practices)
- [TypeScript Guidelines](#typescript-guidelines)
- [Naming Conventions](#naming-conventions)
- [Code Style](#code-style)
- [UI and Styling](#ui-and-styling)
- [Client-Side Storage Security](#client-side-storage-security)
- [Common Pitfalls & How to Avoid Them](#common-pitfalls--how-to-avoid-them)

---

## General Principles

### Core Rules

1. **Use Shadcn UI Components**: Always prefer `@/components/ui/` components over native HTML elements (`<button>` → `<Button>`, `<select>` → `<Select>`, etc.). See [UI and Styling](#ui-and-styling) section.

2. **No Copy-Paste**: If you're copy-pasting code, you're probably doing something wrong. Extract it into a reusable component, hook, or utility.

3. **No Hardcoding**: Avoid magic numbers and hardcoded values. If you're using values other than `0` or `1`, they should be constants.

   ```typescript
   // ❌ Bad
   if (users.length > 5) { ... }
   
   // ✅ Good
   const MAX_USERS_DISPLAY = 5
   if (users.length > MAX_USERS_DISPLAY) { ... }
   ```

4. **Single Responsibility**: Each function/component should do one thing only.

5. **Check Before Building**: Before creating something new, verify it doesn't already exist (components, hooks, types, utilities).

6. **Leverage Early Returns**: Reduce nesting and improve readability.

   ```typescript
   // ❌ Bad
   function processUser(user) {
     if (user) {
       if (user.isActive) {
         if (user.hasPermission) {
           return doSomething()
         }
       }
     }
   }
   
   // ✅ Good
   function processUser(user) {
     if (!user) return
     if (!user.isActive) return
     if (!user.hasPermission) return
     
     return doSomething()
   }
   ```

7. **Consistency**: Match the surrounding code style. Refactoring should be done in separate PRs.

8. **Think in React**: When in doubt, refer to [Thinking in React](https://react.dev/learn/thinking-in-react).

---

## Project Structure

We follow a **module-first architecture** (Level 3 folder structure):

```
traza-frontend/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard routes
│   ├── auth/                     # Authentication routes
│   └── layout.tsx
├── components/                   # Global components (use sparingly)
│   ├── ui/                       # Shadcn UI components
│   └── dashboard-layout.tsx
├── modules/                      # 🎯 Work here most of the time
│   ├── incidents/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   │   └── incidents-service.ts
│   │   └── types/
│   │       └── index.ts
│   ├── interactions/
│   │   ├── services/
│   │   │   └── interactions-service.ts
│   │   └── types/
│   │       └── index.ts
│   ├── integrations/
│   │   ├── constants/
│   │   ├── types/
│   │   └── utils/
│   ├── rag/
│   │   ├── services/
│   │   └── types/
│   └── i18n/
├── lib/                          # Shared infrastructure
│   ├── api-client.ts             # HTTP client
│   ├── auth-context.tsx          # Auth provider
│   ├── types.ts                  # Shared types only
│   └── utils.ts                  # Shared utilities
├── hooks/                        # Global hooks (DEPRECATED)
└── public/                       # Static assets
```

### Where to Put Your Code

- **Module-specific code** → `modules/[domain]/`
- **Shared UI components** → `components/ui/`
- **Routes** → `app/`
- **Global utilities** → `lib/utils.ts`
- **Shared types** → `lib/types.ts` (cross-cutting concerns only)

---

## Module Architecture

Each module is self-contained with its own services, types, hooks, and components.

### Module Structure

```
modules/[domain]/
├── components/          # Domain-specific components
│   └── [component].tsx
├── hooks/              # Domain-specific hooks
│   └── use-[hook].ts
├── lib/                # Module infrastructure (optional)
│   └── swr-keys.ts     # SWR key factories & match predicates (if module has multiple related keys)
├── services/           # API services
│   └── [domain]-service.ts
├── types/              # Domain types
│   └── index.ts
├── constants/          # Domain constants (optional)
│   └── index.ts
└── utils/              # Domain utilities (optional)
    └── index.ts
```

### Creating a New Module

1. **Create the module directory**:
   ```bash
   mkdir -p modules/[domain]/{components,hooks,services,types}
   ```

2. **Define types first** (`modules/[domain]/types/index.ts`):
   ```typescript
   export interface DomainEntity {
     id: string
     name: string
     // ...
   }
   ```

3. **Create the service** (`modules/[domain]/services/[domain]-service.ts`): Use the class-based pattern from [API Services](#api-services).

4. **Create hooks if needed** (`modules/[domain]/hooks/use-[domain].ts`):
   ```typescript
   import useSWR from 'swr'
   import { domainService } from '@/modules/[domain]/services/[domain]-service'
   
   export function useDomain(id: string) {
     return useSWR(`/domain/${id}`, () => domainService.getById(id))
   }
   ```

5. **Build components** (`modules/[domain]/components/`).

### Import Paths

Always use absolute imports from module root:

```typescript
// ✅ Good
import { Incident } from '@/modules/incidents/types'
import { incidentsService } from '@/modules/incidents/services/incidents-service'
import { useIncidents } from '@/modules/incidents/hooks/use-incidents'

// ❌ Bad
import { Incident } from '../../../modules/incidents/types'
```

---

## API Services

Every module should have a service that handles all API communication. Services provide a typed interface to backend endpoints.

### Service Structure

```typescript
// modules/[domain]/services/[domain]-service.ts
import { apiClient } from '@/lib/api-client'
import type { Entity, EntityCreate, EntityUpdate } from '@/modules/[domain]/types'

class EntityService {
  private readonly basePath = '/api/v1/entities'

  async getAll(): Promise<Entity[]> {
    return apiClient.get<Entity[]>(`${this.basePath}/`)
  }
  
  async getById(id: string): Promise<Entity> {
    return apiClient.get<Entity>(`${this.basePath}/${id}`)
  }
  
  async create(data: EntityCreate): Promise<Entity> {
    return apiClient.post<Entity>(`${this.basePath}/`, data)
  }
  
  async update(id: string, data: EntityUpdate): Promise<Entity> {
    return apiClient.patch<Entity>(`${this.basePath}/${id}`, data)
  }
  
  async delete(id: string): Promise<void> {
    return apiClient.delete(`${this.basePath}/${id}`)
  }
}

export const entityService = new EntityService()
```

### Key Principles

1. **All API calls go through services** - Never use `fetch` directly in components
2. **Return typed promises** - Services should return strongly-typed data
3. **Error handling in apiClient** - Network/HTTP errors are handled centrally
4. **Convenience methods** - Add helper methods for common operations

```typescript
// Example: Convenience methods
async getPending(): Promise<Entity[]> {
  return this.getAll({ status: 'pending' })
}

async getByStatus(status: EntityStatus): Promise<Entity[]> {
  return apiClient.get<Entity[]>(`${this.basePath}/`, { status })
}
```

---

## Data Fetching

We use two approaches for fetching data:

### 1. SWR (Stale-While-Revalidate)

**When to use**: Syncing state between frontend and backend (lists, analytics, real-time data).

```typescript
import useSWR from 'swr'
import { interactionsService } from '@/modules/interactions/services/interactions-service'

function InteractionsList() {
  const { data, error, isLoading, mutate } = useSWR(
    '/interactions',
    () => interactionsService.getAll()
  )
  
  if (isLoading) return <Spinner />
  if (error) return <Error />
  
  return <List items={data} onRefresh={mutate} />
}
```

**Benefits**:
- Automatic revalidation
- Cache management
- Deduplication
- Focus revalidation

**Reference**: [SWR Documentation](https://swr.vercel.app/)

#### SWR Keys

**Simple hooks**: Use a string key. It's readable and consistent with the rest of the codebase.

```typescript
// ✅ Good - string key for a single, simple fetch
const { data } = useSWR(
  `/workers?active_only=${activeOnly}`,
  () => workersService.getWorkers(activeOnly)
)
```

**Modules with multiple related keys** (lists, detail views, sub-resources that are invalidated together): define all keys in a `lib/swr-keys.ts` file using **key factories** and **match predicates**. Never inline key strings in `broadcastMutate` filter callbacks — that's a stringly-typed contract that breaks silently when keys change.

```typescript
// modules/[domain]/lib/swr-keys.ts

// Key factories — the only place key strings live
export const ENTITY_KEYS = {
  list:     (cursor: string, size: number) => `domain:entities:${cursor}:${size}` as const,
  detail:   (id: string)                  => ['domain:entity', id] as const,
  children: (id: string)                  => ['domain:entity-children', id] as const,
}

// Named helpers so allRelated can compose without self-reference
const matchList     = (key: unknown) => typeof key === 'string' && key.startsWith('domain:entities')
const matchChildren = (key: unknown) => Array.isArray(key) && key[0] === 'domain:entity-children'

export const ENTITY_MATCH = {
  list:       matchList,
  children:   matchChildren,
  allRelated: (key: unknown) => matchList(key) || matchChildren(key),
}
```

Then use them in hooks and mutation handlers:

```typescript
// In a data hook
const { data } = useSWR(
  ENTITY_KEYS.children(id),
  () => entityService.getChildren(id)
)

// In a mutation hook — invalidate all related keys with one call
const { mutate: broadcastMutate } = useSWRConfig()
await broadcastMutate(ENTITY_MATCH.allRelated, undefined, { revalidate: true })
```

**Why**: If a key string changes, TypeScript will catch every consumer. The `allRelated` predicate becomes the single definition of "what belongs to this module's cache boundary." See `modules/rfq-manager/lib/swr-keys.ts` as the reference implementation.

**Note**: The `switchOrganization` function in `auth-context.tsx` handles both string and array keys for cache invalidation.

### 2. Services (Direct API Calls)

**When to use**: User actions (creating, updating, deleting resources).

```typescript
import { incidentsService } from '@/modules/incidents/services/incidents-service'

async function handleCreateIncident(data: CreateIncidentRequest) {
  try {
    const incident = await incidentsService.createIncident(data)
    // Update UI state
    router.push(`/incidents/${incident.id}`)
  } catch (error) {
    console.error('Failed to create incident:', error)
    setError(error.message)
  }
}
```

### 3. Combining SWR + Mutations

**When to use**: Fetching data with SWR while supporting mutations that update the cache.

```typescript
import useSWR from 'swr'
import { toast } from 'sonner'
import { incidentsService } from '@/modules/incidents/services/incidents-service'

function IncidentsList() {
  const { data: incidents, mutate } = useSWR('/api/incidents', 
    () => incidentsService.getAll()
  )
  const [isCreating, setIsCreating] = useState(false)
  
  async function handleCreate(data: IncidentCreate) {
    setIsCreating(true)
    try {
      await incidentsService.create(data)
      await mutate() // Revalidate the list
      toast.success('Incident created')
    } catch (error) {
      toast.error('Failed to create incident')
    } finally {
      setIsCreating(false)
    }
  }
  
  return (
    <>
      <IncidentTable incidents={incidents} />
      <CreateButton onClick={handleCreate} loading={isCreating} />
    </>
  )
}
```

**Better: Extract to custom hook**

```typescript
// modules/incidents/hooks/use-incident-mutations.ts
import { useState } from 'react'
import { mutate } from 'swr'
import { toast } from 'sonner'
import { incidentsService } from '@/modules/incidents/services/incidents-service'

export function useIncidentMutations() {
  const [isLoading, setIsLoading] = useState(false)
  
  async function createIncident(data: IncidentCreate) {
    setIsLoading(true)
    try {
      const incident = await incidentsService.create(data)
      await mutate('/api/incidents') // Refresh the list
      toast.success('Incident created')
      return incident
    } catch (error) {
      toast.error('Failed to create incident')
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  return { createIncident, isLoading }
}

// Usage in component
function IncidentsList() {
  const { data: incidents } = useSWR('/api/incidents', () => incidentsService.getAll())
  const { createIncident, isLoading } = useIncidentMutations()
  
  return (
    <>
      <IncidentTable incidents={incidents} />
      <CreateButton onClick={createIncident} loading={isLoading} />
    </>
  )
}
```

### ⚠️ Never Use `useEffect` for Data Fetching

Use SWR for data fetching, not `useEffect`. See [React Hooks & Patterns](#react-hooks--patterns) for when to use `useEffect`.

---

## Error Handling

All errors should provide clear user feedback via toast notifications. We use `sonner` for consistent toast behavior.

### Where to Handle Errors

1. **Services**: Network/HTTP errors (handled by `apiClient`)
2. **Hooks**: Display toasts, manage loading states
3. **Components**: Show loading UI, disable buttons

### Pattern

```typescript
// ❌ Bad - Silent failure
async function handleSubmit(data: FormData) {
  await service.create(data)
}

// ❌ Bad - Console errors only
async function handleSubmit(data: FormData) {
  try {
    await service.create(data)
  } catch (error) {
    console.error('Failed:', error) // User sees nothing!
  }
}

// ✅ Good - User feedback with toasts
async function handleSubmit(data: FormData) {
  try {
    await service.create(data)
    toast.success('Created successfully')
  } catch (error) {
    toast.error('Failed to create', {
      description: error instanceof Error ? error.message : 'Please try again'
    })
  }
}
```

### Hooks with Error Handling

```typescript
// SWR hooks with error toasts
export function useActions() {
  return useSWR(
    '/api/actions',
    fetcher,
    {
      onError: (err) => {
        toast.error('Failed to load actions', {
          description: err.message
        })
      }
    }
  )
}

// Mutation hooks with success/error toasts
export function useActionMutations() {
  const [isLoading, setIsLoading] = useState(false)
  
  async function createAction(data: ActionCreate) {
    setIsLoading(true)
    try {
      const action = await actionsService.create(data)
      await mutate('/api/actions')
      toast.success('Action created')
      return action
    } catch (error) {
      toast.error('Failed to create action')
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  return { createAction, isLoading }
}
```

---

## React Hooks & Patterns

### useEffect - When & How to Use It

#### ✅ Valid Uses

useEffect is for **synchronizing with external systems** - anything outside React's control.

```typescript
// ✅ Good - External event subscription
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  
  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    window.addEventListener('resize', handleResize)
    handleResize() // Initial value
    
    return () => window.removeEventListener('resize', handleResize)
  }, []) // No dependencies - setup once
  
  return size
}

// ✅ Good - Browser API sync
function useDarkMode() {
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    setIsDark(stored === 'dark')
  }, [])
  
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])
}

// ✅ Good - Third-party library integration
function useD3Chart(data: ChartData) {
  const ref = useRef<SVGSVGElement>(null)
  
  useEffect(() => {
    if (!ref.current) return
    
    const chart = d3.select(ref.current)
    // D3 manipulation...
    
    return () => chart.remove()
  }, [data])
  
  return ref
}
```

#### ❌ Common Mistakes

```typescript
// ❌ Bad - Deriving state (do it during render!)
function UserGreeting({ user }) {
  const [greeting, setGreeting] = useState('')
  
  useEffect(() => {
    setGreeting(`Hello, ${user.firstName}!`)
  }, [user])
  
  return <h1>{greeting}</h1>
}

// ✅ Good - Compute during render
function UserGreeting({ user }) {
  const greeting = `Hello, ${user.firstName}!`
  return <h1>{greeting}</h1>
}
```

```typescript
// ❌ Bad - Chaining state updates
function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  
  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(setResults)
  }, [query])
}

// ✅ Good - Use SWR
function Search() {
  const [query, setQuery] = useState('')
  const { data: results } = useSWR(
    query ? `/api/search?q=${query}` : null,
    fetcher
  )
}
```

```typescript
// ❌ Bad - Event handler in useEffect
function Button() {
  useEffect(() => {
    function handleClick() {
      console.log('clicked')
    }
    
    button.addEventListener('click', handleClick)
    return () => button.removeEventListener('click', handleClick)
  }, [])
}

// ✅ Good - Direct handler
function Button() {
  function handleClick() {
    console.log('clicked')
  }
  
  return <button onClick={handleClick}>Click</button>
}
```

### State Management - Decision Tree

**Where should your state live?** Follow this order:

1. **Local state** - If only one component needs it → `useState` in that component
2. **Lifted state** - If 2-3 nearby components need it → Lift to common parent
3. **Context** - If many distant components need it → `createContext` + `useContext`
4. **SWR** - If it's server data → Use SWR (never copy to `useState`!)
5. **URL state** - If it should be shareable/bookmarkable → Use `nuqs`

```typescript
// ✅ Local state - Component-specific
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// ✅ Lifted state - Shared between siblings
function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  
  return (
    <>
      <PersonalInfo data={formData} onChange={setFormData} />
      <ContactDetails data={formData} onChange={setFormData} />
      <FormSummary data={formData} />
    </>
  )
}

// ✅ Context - Deep tree, avoid prop drilling
const ThemeContext = createContext<Theme>({ mode: 'light' })

function App() {
  const [theme, setTheme] = useState({ mode: 'light' })
  
  return (
    <ThemeContext.Provider value={theme}>
      <Layout>
        <Sidebar /> {/* Can access theme without props */}
        <DeepNestedButton /> {/* Can access theme */}
      </Layout>
    </ThemeContext.Provider>
  )
}

// ✅ SWR - Server data (NOT useState!)
function UserProfile() {
  const { data: user } = useSWR('/api/user', fetcher)
  // ❌ Don't do: const [user, setUser] = useState()
  
  if (!user) return <Skeleton />
  return <div>{user.name}</div>
}

// ✅ URL state - Filters, tabs, search
function ProductList() {
  const [search, setSearch] = useQueryState('search')
  const [category, setCategory] = useQueryState('category')
  // URL: /products?search=laptop&category=electronics
  // Shareable, bookmarkable, back-button works
}

// ❌ Bad - Don't sync URL params with useEffect + useState + router.push
// Use nuqs directly. The URL is the source of truth.
```

**Avoid duplicating fallback logic across layers.** When the same default/fallback must apply to both display and data (e.g. "empty selection = use first option"), compute it once as a derived value and pass it down — don't re-derive it independently in each consumer. `??` only triggers on `null`/`undefined`; an empty array `[]` is neither, so duplicated logic can diverge.

```typescript
// ❌ Bad - Fallback logic in two places, can disagree (e.g. [] vs ??)
const sel = selectedEmails[id] ?? [emails[0]]  // recipients
const effective = selectedEmails.length === 0 ? [emails[0]] : selectedEmails  // UI

// ✅ Good - Single source of truth
const effectiveMap = useMemo(() => {
  const result = {}
  items.forEach((item) => {
    const chosen = selected[item.id]
    result[item.id] = chosen?.length ? chosen : [available[0]]
  })
  return result
}, [items, selected, available])
```

### Performance Optimization

#### Don't Optimize Prematurely

**Default rule**: Write simple code first. Only optimize when you have a proven performance problem.

#### useCallback - Stable Function References

**Use when**:
- Function is passed to memoized child component
- Function is a dependency in `useEffect`
- Function is used in other hooks' dependencies

```typescript
// ❌ Bad - Unnecessary useCallback
function Parent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])
  
  // Regular button doesn't benefit from stable reference
  return <button onClick={handleClick}>Click</button>
}

// ✅ Good - Child is memoized
const ExpensiveList = memo(function ExpensiveList({ onItemClick }) {
  return items.map(item => <ExpensiveItem key={item.id} onClick={onItemClick} />)
})

function Parent() {
  const handleItemClick = useCallback((id: string) => {
    // Without useCallback, ExpensiveList re-renders on every Parent render
    updateItem(id)
  }, [])
  
  return <ExpensiveList onItemClick={handleItemClick} />
}

// ✅ Good - useEffect dependency
function SearchInput() {
  const [query, setQuery] = useState('')
  
  const debouncedSearch = useCallback(
    debounce((q: string) => searchAPI(q), 300),
    []
  )
  
  useEffect(() => {
    debouncedSearch(query)
  }, [query, debouncedSearch]) // Stable reference prevents effect re-creation
}
```

#### useMemo - Expensive Computations

**Use when**:
- Computation is genuinely expensive (loops, sorting, filtering large arrays)
- Maintaining referential equality for object/array dependencies

```typescript
// ❌ Bad - Premature optimization
function UserCount({ users }) {
  const count = useMemo(() => users.length, [users]) // Overkill!
  return <div>{count} users</div>
}

// ✅ Good - Expensive computation
function DataTable({ data }: { data: Item[] }) {
  const sortedAndFiltered = useMemo(() => {
    return data
      .filter(item => item.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => transformItem(item))
  }, [data]) // Only recompute when data changes
  
  return <Table rows={sortedAndFiltered} />
}

// ✅ Good - Object/array as dependency
function SearchResults({ filters }: { filters: Filters }) {
  const queryKey = useMemo(
    () => ({ ...filters, timestamp: Date.now() }),
    [filters]
  )
  
  // SWR uses queryKey for cache - needs stable reference
  const { data } = useSWR(queryKey, fetcher)
}
```

**Measuring Performance**: Use React DevTools Profiler before optimizing!

### Custom Hooks Best Practices

**Rules**:
1. Always prefix with `use` (enforced by React)
2. Single responsibility - one concern per hook
3. Return arrays for generic hooks, objects for specific ones
4. Co-locate with domain (`modules/[domain]/hooks/`)

```typescript
// ✅ Array return - Generic utility (like useState)
function useToggle(initial = false) {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue(v => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])
  
  return [value, { toggle, setTrue, setFalse }] as const
}

// Usage
const [isOpen, { toggle, setTrue }] = useToggle()

// ✅ Object return - Domain-specific logic
function useAuth() {
  const { data: user } = useSWR('/api/user', fetcher)
  
  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    hasPermission: (permission: string) => user?.permissions.includes(permission)
  }
}

// Usage
const { user, isAuthenticated, hasPermission } = useAuth()

// ✅ Good - Extract complex logic
function useIntersectionObserver(ref: RefObject<Element>, options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      options
    )
    
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, options])
  
  return isIntersecting
}
```

### useState vs useReducer

**Use useState when**:
- Simple state (primitives, single values)
- Independent state updates
- No complex logic between updates

**Use useReducer when**:
- Complex state object with multiple fields
- Next state depends on previous in complex ways
- Multiple related state transitions
- State logic is testable separately

```typescript
// ✅ useState - Simple independent values
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
}

// ✅ useReducer - Complex interdependent state
type AsyncState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: T | null
  error: Error | null
}

type AsyncAction<T> = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: T }
  | { type: 'FETCH_ERROR'; error: Error }
  | { type: 'RESET' }

function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading', error: null }
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.payload, error: null }
    case 'FETCH_ERROR':
      return { status: 'error', data: null, error: action.error }
    case 'RESET':
      return { status: 'idle', data: null, error: null }
  }
}

function DataFetcher() {
  const [state, dispatch] = useReducer(asyncReducer, {
    status: 'idle',
    data: null,
    error: null
  })
  
  async function fetchData() {
    dispatch({ type: 'FETCH_START' })
    try {
      const data = await api.getData()
      dispatch({ type: 'FETCH_SUCCESS', payload: data })
    } catch (error) {
      dispatch({ type: 'FETCH_ERROR', error: error as Error })
    }
  }
}
```

---

## React Best Practices

### Component Structure

```typescript
'use client' // Only if needed

import { useState } from 'react'
import type { ComponentProps } from '@/modules/[domain]/types'

// 1. Interface/Type definitions
interface MyComponentProps {
  title: string
  onSubmit: (data: FormData) => void
}

// 2. Main component
export function MyComponent({ title, onSubmit }: MyComponentProps) {
  // 3. Hooks (order: state, context, refs, effects)
  const [isOpen, setIsOpen] = useState(false)
  
  // 4. Event handlers
  function handleSubmit(data: FormData) {
    onSubmit(data)
    setIsOpen(false)
  }
  
  // 5. Early returns
  if (!title) return null
  
  // 6. Render
  return (
    <div>
      <h1>{title}</h1>
      {/* ... */}
    </div>
  )
}
```

### Key Principles

1. **One component per file** (except small stateless helpers)

2. **Use composition over inheritance**:
   ```typescript
   // ✅ Good
   <Card>
     <CardHeader>Title</CardHeader>
     <CardContent>Content</CardContent>
   </Card>
   
   // ❌ Bad
   <Card title="Title" content="Content" />
   ```

3. **Prefer controlled components**:
   ```typescript
   // ✅ Good
   <Input value={value} onChange={setValue} />
   
   // ❌ Avoid
   <Input defaultValue={value} />
   ```

4. **Extract reusable logic into hooks**:
   ```typescript
   function useFormState(initialValues) {
     const [values, setValues] = useState(initialValues)
     const [errors, setErrors] = useState({})
     
     // ... logic
     
     return { values, errors, handleChange, validate }
   }
   ```

5. **Store state in the URL** (use [nuqs](https://nuqs.47ng.com/)):
   ```typescript
   import { useQueryState } from 'nuqs'
   
   const [search, setSearch] = useQueryState('search')
   ```

---

## TypeScript Guidelines

### Always Use Types

```typescript
// ✅ Good
function processUser(user: User): ProcessedUser {
  return { ...user, processed: true }
}

// ❌ Bad
function processUser(user: any) {
  return { ...user, processed: true }
}
```

### Prefer Interfaces Over Types

```typescript
// ✅ Good
export interface User {
  id: string
  email: string
}

// ⚠️ Use sparingly
export type UserId = string
```

### Avoid Enums, Use Maps

```typescript
// ❌ Bad
enum Status {
  Active = 'active',
  Inactive = 'inactive'
}

// ✅ Good
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type Status = typeof STATUS[keyof typeof STATUS]
```

### Type Components

```typescript
interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}

export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  // ...
}
```

---

## Naming Conventions

### General Rules

- **Variables & Functions**: `camelCase`
- **Components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `kebab-case`
- **Folders**: `kebab-case`

### Specific Conventions

```typescript
// ✅ Variables with auxiliary verbs
const isLoading = false
const hasError = true
const canEdit = user.isAdmin

// ✅ React hooks start with 'use'
function useCustomHook() { ... }

// ✅ Constants
const MAX_RETRY_ATTEMPTS = 3
const API_BASE_URL = process.env.API_URL

// ✅ Component files match component names
// File: user-card.tsx
export function UserCard() { ... }

// ✅ Event handlers
function handleClick() { ... }
function handleSubmit() { ... }
```

### Props Naming

```typescript
// ✅ Good
<Component
  userName="john"
  isActive
  onSubmit={handleSubmit}
  CustomIcon={CheckIcon}
/>

// ❌ Bad
<Component
  UserName="john"           // Wrong case
  is_active={true}          // Snake case
  on-submit={handleSubmit}  // Kebab case
  custom-icon={CheckIcon}   // Wrong case
/>
```

### Import Naming

```typescript
// ✅ Good
import { UserCard } from '@/components/user-card'
import { useAuth } from '@/hooks/use-auth'
import { API_URL } from '@/lib/constants'

// ❌ Bad
import { userCard } from '@/components/user-card'  // Wrong case
import UserCard from '@/components/user-card/UserCard'  // Redundant path
```

---

## Code Style

### Formatting

We use the repository's ESLint and Prettier configuration. Key points:

1. **No semicolons** (enforced by Prettier)
2. **Use `function` keyword** for pure functions
3. **Functional components** with TypeScript interfaces
4. **Destructure props** in function signature

```typescript
// ✅ Good
export function UserProfile({ user, onEdit }: UserProfileProps) {
  function handleEdit() {
    onEdit(user.id)
  }
  
  return <div onClick={handleEdit}>{user.name}</div>
}

// ❌ Bad
export function UserProfile(props) {
  const handleEdit = () => {
    props.onEdit(props.user.id);
  };
  
  return <div onClick={handleEdit}>{props.user.name}</div>;
}
```

### File Structure

```typescript
'use client'

// 1. External imports
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Internal imports (absolute paths)
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

// 3. Module imports
import type { User } from '@/modules/users/types'
import { usersService } from '@/modules/users/services/users-service'

// 4. Types/Interfaces
interface ComponentProps {
  // ...
}

// 5. Component
export function Component() {
  // ...
}
```

### Conditional Rendering

```typescript
// ✅ Good - Early returns
if (!user) return null
if (isLoading) return <Spinner />
if (error) return <ErrorMessage error={error} />

return <UserProfile user={user} />

// ❌ Bad - Nested ternaries
return (
  <>
    {user ? (
      isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage />
      ) : (
        <UserProfile />
      )
    ) : null}
  </>
)
```

---

## UI and Styling

### Core Principle: Use Shadcn UI Components

**Always prefer Shadcn UI components from `@/components/ui/` over native HTML elements.**

Our UI library is built on Shadcn UI + Radix + Tailwind CSS. These components provide:
- Consistent design system
- Built-in accessibility (ARIA)
- Keyboard navigation
- Type safety
- Responsive behavior

### Available Components

Check `components/ui/` for available components:

```
components/ui/
├── button.tsx          ← Use instead of <button>
├── input.tsx           ← Use instead of <input>
├── select.tsx          ← Use instead of <select>
├── textarea.tsx        ← Use instead of <textarea>
├── dialog.tsx          ← Use for modals/dialogs
├── label.tsx           ← Use instead of <label>
├── badge.tsx           ← Use for tags/status
├── card.tsx            ← Use for card layouts
├── tabs.tsx            ← Use for tabbed interfaces
├── dropdown-menu.tsx   ← Use for menus
├── tooltip.tsx         ← Use for tooltips
└── ... (and more)
```

### Examples

#### ❌ Don't Use Native HTML Elements

```typescript
// Bad - Native HTML
<button onClick={handleClick}>Click me</button>

<select value={value} onChange={handleChange}>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>

<textarea value={text} onChange={handleChange} />

<input type="text" value={value} onChange={handleChange} />
```

#### ✅ Do Use Shadcn UI Components

```typescript
// Good - Shadcn UI
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<Button onClick={handleClick}>Click me</Button>

<Select value={value} onValueChange={handleChange}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>

<Textarea value={text} onChange={handleChange} />

<div>
  <Label htmlFor="name">Name</Label>
  <Input id="name" value={value} onChange={handleChange} />
</div>
```

### Dialog/Modal Pattern

Follow the established pattern from `modules/tabular-review/components/create-review-modal.tsx`:

```typescript
// Use custom dialog structure (backdrop + modal)
function MyDialog({ isOpen, onClose }: MyDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl mx-4">
        {/* Header with close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-[16px] font-medium">Title</h2>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Content */}
        </div>
      </div>
    </div>
  )
}
```

### Styling with Tailwind

- Use **Tailwind CSS** for all styling (mobile-first approach)
- Never write custom CSS unless absolutely necessary
- Use the `cn()` utility to merge classes:

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  'base-classes',
  className,
  {
    'active-classes': isActive,
    'disabled-classes': isDisabled
  }
)} />
```

### Quick Reference

| Need | Use | Import From |
|------|-----|-------------|
| Button | `<Button>` | `@/components/ui/button` |
| Input | `<Input>` | `@/components/ui/input` |
| Select | `<Select>` | `@/components/ui/select` |
| Textarea | `<Textarea>` | `@/components/ui/textarea` |
| Label | `<Label>` | `@/components/ui/label` |
| Dialog/Modal | Custom pattern | See examples in `@/modules/tabular-review` |
| Badge | `<Badge>` | `@/components/ui/badge` |
| Card | `<Card>` | `@/components/ui/card` |
| Tabs | `<Tabs>` | `@/components/ui/tabs` |

**Before creating any form or UI component, check `components/ui/` first!**

---

## Client-Side Storage Security

### Storage Types & When to Use Them

| Storage | Accessibility | Lifespan | Use For |
|---------|--------------|----------|---------|
| **HttpOnly Cookies** | Server-only | Configurable | 🔒 Auth tokens, sessions |
| **Regular Cookies** | JavaScript-accessible | Configurable | Context (org_id), preferences |
| **sessionStorage** | JavaScript-accessible | Tab session | Temporary form state |
| **localStorage** | JavaScript-accessible | Permanent | UI preferences only |

### ✅ What to Store in Each

#### HttpOnly Cookies (Set by Backend)
**Use for security-sensitive data:**
```typescript
// ✅ Backend sets these (you NEVER handle in frontend)
sb-access-token     // JWT access token
sb-refresh-token    // Refresh token
```
**Properties:** `HttpOnly`, `Secure`, `SameSite=Lax`

#### Regular Cookies (Set by Frontend)
**Use for non-sensitive context:**
```typescript
// ✅ Safe to store - needed for multi-tenant context
organization_id     // Current organization (not auth!)

// Setting a cookie
document.cookie = `organization_id=${id}; path=/; SameSite=Lax; Secure`
```
**When to use:** Data needed by both client AND server-side rendering

#### sessionStorage
**Use for temporary, tab-scoped state:**
```typescript
// ✅ Good uses
sessionStorage.setItem('draft_form_data', JSON.stringify(formData))
sessionStorage.setItem('wizard_step', '2')
sessionStorage.setItem('search_filters', JSON.stringify(filters))
```
**Cleared when:** Tab closes  
**Good for:** Multi-step forms, temporary filters, unsaved drafts

#### localStorage  
**Use ONLY for UI preferences:**
```typescript
// ✅ Safe uses
localStorage.setItem('theme', 'dark')
localStorage.setItem('sidebar_collapsed', 'true')
localStorage.setItem('locale', 'en')
localStorage.setItem('tag_colors', JSON.stringify(colors))
localStorage.setItem('table_column_widths', JSON.stringify(widths))
```
**Persists:** Forever (until cleared)  
**Good for:** UI state that survives page refresh

### ❌ NEVER Store in localStorage/sessionStorage

```typescript
// ❌ Security vulnerabilities - NEVER do this
localStorage.setItem('access_token', token)      // XSS attack vector
localStorage.setItem('refresh_token', token)     // Critical vulnerability
localStorage.setItem('api_key', key)             // Exposed to all scripts
localStorage.setItem('session_id', id)           // Session hijacking risk
localStorage.setItem('password', pass)           // Obvious security issue
localStorage.setItem('user_email', email)        // Privacy violation (use state)
```

**Why?** Any malicious script (XSS, compromised npm package, browser extension) can read localStorage.

### Best Practices

#### 1. Authentication Tokens
```typescript
// ✅ Correct - Let backend handle via HttpOnly cookies
await fetch('/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',  // Browser handles cookies
  body: JSON.stringify({ email, password })
})
// Backend sets HttpOnly cookies automatically
```

```typescript
// ❌ Wrong - NEVER manually handle tokens
const { access_token } = await response.json()
localStorage.setItem('token', access_token)  // Vulnerability!
```

#### 2. User/Organization Context
```typescript
// ✅ Correct - Fetch from API, store in React state
const { user } = useAuth()  // Gets from server
const selectedOrgId = user.organizations[0].id

// ❌ Wrong - Don't persist sensitive user data
localStorage.setItem('user', JSON.stringify(user))  // Privacy issue
```

#### 3. Temporary Form Data
```typescript
// ✅ Good - sessionStorage for unsaved drafts
function AutosaveDraft({ formData }) {
  useEffect(() => {
    sessionStorage.setItem('draft', JSON.stringify(formData))
  }, [formData])
}

// Clear on submit
function handleSubmit() {
  sessionStorage.removeItem('draft')
  // Submit...
}
```

#### 4. UI Preferences
```typescript
// ✅ Good - localStorage for persistent UI state
function ThemeToggle() {
  const [theme, setTheme] = useState(() => 
    localStorage.getItem('theme') || 'light'
  )
  
  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }
}
```

### Security Checklist

Before using client-side storage, ask:

- [ ] Is this authentication-related? → **Use HttpOnly cookies (backend)**
- [ ] Is this sensitive user data? → **Fetch from API, use React state**
- [ ] Is this temporary form state? → **Use sessionStorage**
- [ ] Is this just UI preference? → **Use localStorage**

### Migration Pattern

If you find localStorage being used incorrectly:

```typescript
// ❌ Before (insecure)
localStorage.setItem('user_token', token)

// ✅ After (secure)
// Remove the localStorage code - backend handles via HttpOnly cookies
// Just use credentials: 'include' in fetch calls
```

---

## Common Pitfalls & How to Avoid Them

Learn from these real-world mistakes to level up faster.

### 1. Copying Server Data into useState

```typescript
// ❌ Bad - Duplicating server state
function UserProfile() {
  const { data: serverUser } = useSWR('/api/user', fetcher)
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    if (serverUser) {
      setUser(serverUser) // Why?!
    }
  }, [serverUser])
}

// ✅ Good - Use server state directly
function UserProfile() {
  const { data: user } = useSWR('/api/user', fetcher)
  
  if (!user) return <Skeleton />
  return <div>{user.name}</div>
}
```

**Why it's bad**: Two sources of truth, stale data, unnecessary re-renders.

### 2. Not Cleaning Up Side Effects

```typescript
// ❌ Bad - Memory leak!
function Timer() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('tick')
    }, 1000)
    // Missing cleanup!
  }, [])
}

// ✅ Good - Cleanup function
function Timer() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('tick')
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
}
```

**Why it's bad**: Memory leaks, duplicate listeners, unexpected behavior.

### 3. Forgetting Keys in Lists

```typescript
// ❌ Bad - No keys
function UserList({ users }) {
  return users.map(user => <UserCard user={user} />)
}

// ❌ Bad - Index as key (anti-pattern for dynamic lists)
function UserList({ users }) {
  return users.map((user, index) => <UserCard key={index} user={user} />)
}

// ✅ Good - Stable unique key
function UserList({ users }) {
  return users.map(user => <UserCard key={user.id} user={user} />)
}
```

**Why it's bad**: React can't track items correctly, broken animations, lost state.

### 4. Mutating State Directly

```typescript
// ❌ Bad - Mutating state
function TodoList() {
  const [todos, setTodos] = useState([])
  
  function addTodo(text) {
    todos.push({ id: Date.now(), text }) // Mutation!
    setTodos(todos) // React won't detect the change
  }
}

// ✅ Good - Immutable update
function TodoList() {
  const [todos, setTodos] = useState([])
  
  function addTodo(text) {
    setTodos([...todos, { id: Date.now(), text }])
  }
  
  // Or better with functional update
  function addTodoSafe(text) {
    setTodos(prev => [...prev, { id: Date.now(), text }])
  }
}
```

**Why it's bad**: React won't re-render, state becomes unpredictable.

### 5. Using State for Derived Values

```typescript
// ❌ Bad - Redundant state
function ShoppingCart({ items }) {
  const [total, setTotal] = useState(0)
  
  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + item.price, 0)
    setTotal(newTotal)
  }, [items])
}

// ✅ Good - Compute during render
function ShoppingCart({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  return <div>Total: ${total}</div>
}
```

**Why it's bad**: Extra re-renders, complexity, potential sync issues.

### 6. Not Handling Loading & Error States

```typescript
// ❌ Bad - No loading/error handling
function Users() {
  const { data: users } = useSWR('/api/users', fetcher)
  
  return users.map(user => <UserCard user={user} />) // Crashes if users is undefined!
}

// ✅ Good - Handle all states
function Users() {
  const { data: users, error, isLoading } = useSWR('/api/users', fetcher)
  
  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!users || users.length === 0) return <EmptyState />
  
  return users.map(user => <UserCard key={user.id} user={user} />)
}
```

**Why it's bad**: Runtime errors, poor UX, unreliable app.

### 7. Overusing Context

```typescript
// ❌ Bad - Context for everything
const AppContext = createContext()

function App() {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState([])
  const [settings, setSettings] = useState({})
  // ... 10 more states
  
  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, /* ... */ }}>
      <DeepComponent /> {/* Every state change re-renders entire tree! */}
    </AppContext.Provider>
  )
}

// ✅ Good - Split contexts by concern
const UserContext = createContext()
const ThemeContext = createContext()

function App() {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <DeepComponent /> {/* Only re-renders when relevant context changes */}
      </ThemeContext.Provider>
    </UserContext.Provider>
  )
}
```

**Why it's bad**: Unnecessary re-renders, performance issues.

### 8. Async State Updates

```typescript
// ❌ Bad - Stale closure
function Counter() {
  const [count, setCount] = useState(0)
  
  function handleClick() {
    setTimeout(() => {
      setCount(count + 1) // Uses stale count!
    }, 1000)
  }
  
  // Click 3 times fast → count is 1, not 3!
}

// ✅ Good - Functional update
function Counter() {
  const [count, setCount] = useState(0)
  
  function handleClick() {
    setTimeout(() => {
      setCount(prev => prev + 1) // Always uses latest
    }, 1000)
  }
}
```

**Why it's bad**: Lost updates, incorrect state values.

### 9. useEffect Dependencies & Data Fetching

See [React Hooks & Patterns](#react-hooks--patterns) for complete guidance on useEffect dependencies and why you should never use it for data fetching.

### 10. Props Drilling Instead of Composition

```typescript
// ❌ Bad - Props drilling
function App() {
  const [user, setUser] = useState(null)
  
  return <Dashboard user={user} setUser={setUser} />
}

function Dashboard({ user, setUser }) {
  return <Layout user={user} setUser={setUser} />
}

function Layout({ user, setUser }) {
  return <Sidebar user={user} setUser={setUser} />
}

function Sidebar({ user, setUser }) {
  return <UserMenu user={user} setUser={setUser} />
}

// ✅ Good - Composition
function App() {
  const [user, setUser] = useState(null)
  
  return (
    <Dashboard>
      <Layout>
        <Sidebar>
          <UserMenu user={user} onUserChange={setUser} />
        </Sidebar>
      </Layout>
    </Dashboard>
  )
}

// ✅ Or Context for deep trees
const UserContext = createContext()

function App() {
  const [user, setUser] = useState(null)
  
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Dashboard />
    </UserContext.Provider>
  )
}
```

**Why it's bad**: Maintenance nightmare, brittle components.

### 11. Calling setState During Render

```typescript
// ❌ Bad - setState during render
if (queryId !== lastQueryId) {
  setLastQueryId(queryId)
  setCurrentCursor(null)
}

// ✅ Good - Use a ref to track previous value
const prevQueryIdRef = useRef(queryId)
if (queryId !== prevQueryIdRef.current) {
  prevQueryIdRef.current = queryId
  setCurrentCursor(null)
}
```

**Why it's bad**: React may warn, behavior can be unpredictable. Use `useRef` for "reset when X changes" logic.

### 12. Using `useRef` + `useEffect` to Wire SWR `mutate` Across Component Boundaries

```typescript
// ❌ Bad - Passing a ref down so a parent can call a child's mutate
interface ChildProps {
  mutateRef?: React.RefObject<(() => Promise<unknown>) | null>
}

function Child({ mutateRef }: ChildProps) {
  const { data, mutate } = useSWR(SOME_KEY, fetcher)

  useEffect(() => {
    if (!mutateRef) return
    mutateRef.current = mutate        // wiring mutate into a ref
    return () => { mutateRef.current = null }
  }, [mutateRef, mutate])
}

function Parent() {
  const mutateRef = useRef(null)

  async function handleRefresh() {
    await mutateRef.current?.()       // calls child's mutate imperatively
  }

  return <Child mutateRef={mutateRef} />
}
```

```typescript
// ✅ Good - broadcastMutate with a typed match predicate
// modules/[domain]/lib/swr-keys.ts
export const ENTITY_MATCH = {
  allRelated: (key: unknown) => /* predicate */,
}

// In the parent hook - no ref, no prop, no useEffect
function useParentPage() {
  const { mutate: broadcastMutate } = useSWRConfig()

  const handleRefresh = useCallback(async () => {
    await broadcastMutate(ENTITY_MATCH.allRelated, undefined, { revalidate: true })
  }, [broadcastMutate])

  return { handleRefresh }
}
```

**Why it's bad**: The ref pattern leaks SWR internals upward, creates a timing window where the ref is null, and requires matching `useEffect` cleanup in every child. `broadcastMutate` with a predicate from `swr-keys.ts` achieves the same result with zero coupling — the parent doesn't need to know which components own which keys.

---

## Testing (Coming Soon)

We'll add testing guidelines as we expand our test coverage.

---

## Pull Request Guidelines

1. **Keep PRs focused**: One feature or fix per PR
2. **Refactoring**: Do refactoring in separate PRs
3. **Write clear descriptions**: Explain what and why
4. **Update documentation**: If you change functionality
5. **Check linting**: Run `npm run lint` before committing

---

## Questions?

When in doubt:
- Check existing code for patterns
- Refer to [Airbnb React Style Guide](https://github.com/airbnb/javascript/tree/master/react)
- Ask the team in Slack

**Remember**: These guidelines exist to help us move fast while maintaining quality. They're not set in stone—if something doesn't make sense, let's discuss it!

