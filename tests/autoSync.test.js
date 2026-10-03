import { describe, expect, it, vi } from 'vitest'
import { runAutoSync } from '../src/lib/useGoogleSheetsAutoSync.js'
import { forgetAccessToken, getCachedAccessToken, rememberAccessToken } from '../src/lib/googleSheetsSync.js'

const connected = { googleSheets: { connected: true, clientId: 'c', sheetId: 's' } }

function deps(overrides = {}) {
  const saved = []
  return {
    saved,
    getSettings: () => connected,
    getTransactions: () => [{ id: 't1' }],
    getToken: () => 'tok',
    push: vi.fn().mockResolvedValue({ rowCount: 1 }),
    save: (patch) => saved.push(patch),
    dropToken: vi.fn(),
    now: () => 'NOW',
    ...overrides
  }
}

describe('runAutoSync', () => {
  it('does nothing when sync is not connected', async () => {
    const d = deps({ getSettings: () => ({ googleSheets: { connected: false } }) })
    expect(await runAutoSync(d)).toBe('disabled')
    expect(d.push).not.toHaveBeenCalled()
  })

  it('pushes using the token the app already holds, and records the sync', async () => {
    const d = deps()
    expect(await runAutoSync(d)).toBe('synced')
    expect(d.push).toHaveBeenCalledWith({ accessToken: 'tok', sheetId: 's', transactions: [{ id: 't1' }] })
    expect(d.saved).toEqual([{ lastSyncedAt: 'NOW', needsReconnect: false }])
  })

  it('with no valid token it pauses quietly — it has no way to ask Google for one', async () => {
    const d = deps({ getToken: () => null })
    expect(await runAutoSync(d)).toBe('paused')
    expect(d.push).not.toHaveBeenCalled()
    expect(d.saved).toEqual([{ needsReconnect: true }])
  })

  it('pauses and forgets the token when Google rejects it as unauthorised', async () => {
    const d = deps({ push: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 401 })) })
    expect(await runAutoSync(d)).toBe('paused')
    expect(d.dropToken).toHaveBeenCalled()
    expect(d.saved).toEqual([{ needsReconnect: true }])
  })

  it('treats a network hiccup as a plain failure: stays connected, not paused, retried on the next edit', async () => {
    const d = deps({ push: vi.fn().mockRejectedValue(new Error('offline')) })
    expect(await runAutoSync(d)).toBe('failed')
    expect(d.saved).toEqual([])
  })
})

describe('access token cache', () => {
  it('serves a remembered token until a minute before it expires, then nothing', () => {
    rememberAccessToken({ access_token: 'abc', expires_in: 3600 }, 1_000_000)
    expect(getCachedAccessToken(1_000_000 + 60_000)).toBe('abc')
    expect(getCachedAccessToken(1_000_000 + 3_600_000 - 59_000)).toBeNull()
  })

  it('forgets the token on request', () => {
    rememberAccessToken({ access_token: 'abc', expires_in: 3600 })
    forgetAccessToken()
    expect(getCachedAccessToken()).toBeNull()
  })
})
