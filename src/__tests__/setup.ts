import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Required: mock 'server-only' globally so any transitive import doesn't fail
vi.mock('server-only', () => ({}))
