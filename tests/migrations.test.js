import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations, SCHEMA_VERSION } from '../src/lib/migrations.js'
import { clearAll, getItem, setItem } from '../src/lib/storage.js'

describe('runMigrations', () => {
  beforeEach(() => {
    clearAll()
  })

  it('seeds default collections and stamps the schema version', () => {
    const version = runMigrations()

    expect(version).toBe(SCHEMA_VERSION)
    expect(getItem('transactions', null)).toEqual([])
    expect(getItem('schemaVersion', 0)).toBe(SCHEMA_VERSION)
  })

  it('is idempotent on an already-migrated store', () => {
    runMigrations()
    setItem('transactions', [{ id: 'keep-me' }])

    const version = runMigrations()

    expect(version).toBe(SCHEMA_VERSION)
    expect(getItem('transactions', [])).toEqual([{ id: 'keep-me' }])
  })
})
