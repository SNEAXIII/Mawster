import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import { decodeJwt, refreshBackendToken, tokenFromBackend } from '@/app/lib/auth-refresh'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`
const ACCESS = jwt({ user_id: 'u1', role: 'user', type: 'access', exp: 100 })
const FIELDS = {
  id: 'u1',
  role: 'user',
  accessToken: ACCESS,
  backendRefreshToken: 'r2',
  accessTokenExpires: 100_000,
  expired: false,
  backendAuthenticated: true,
}
const EXPIRED = { expired: true, backendAuthenticated: false }

describe('decodeJwt / tokenFromBackend', () => {
  it('decodes the payload, null on garbage', () => {
    expect(decodeJwt(ACCESS)).toMatchObject({ user_id: 'u1', exp: 100 })
    expect(decodeJwt('garbage')).toBeNull()
  })

  it('maps a backend pair to NextAuth fields, exp in ms', () => {
    expect(tokenFromBackend({ access_token: ACCESS, refresh_token: 'r2' })).toEqual(FIELDS)
  })

  it.each([{}, { access_token: 'garbage' }, { access_token: jwt({ user_id: 'u1' }) }])(
    '%j → null',
    (data) => {
      expect(tokenFromBackend(data)).toBeNull()
    }
  )
})

describe('refreshBackendToken', () => {
  const fetch = vi.fn()
  beforeEach(() => {
    fetch.mockReset()
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  const ok = (body: object) => Response.json(body)
  const fail = () => new Response(null, { status: 401 })

  it('uses the backend refresh token first', async () => {
    fetch.mockResolvedValueOnce(ok({ access_token: ACCESS, refresh_token: 'r2' }))
    const token = { backendRefreshToken: 'r1', other: 1 } as JWT
    expect(await refreshBackendToken(token)).toEqual({ ...token, ...FIELDS })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('falls back to Discord when the backend refresh fails', async () => {
    fetch
      .mockResolvedValueOnce(fail())
      .mockResolvedValueOnce(ok({ access_token: 'discord', refresh_token: 'd2' }))
      .mockResolvedValueOnce(ok({ access_token: ACCESS, refresh_token: 'r2' }))
    const result = await refreshBackendToken({
      backendRefreshToken: 'r1',
      discordRefreshToken: 'd1',
    } as JWT)
    expect(result).toMatchObject({ ...FIELDS, discordRefreshToken: 'd2' })
    expect(fetch.mock.calls[1][0]).toBe('https://discord.com/api/oauth2/token')
  })

  it.each([
    ['no refresh token at all', [], {}],
    ['Discord refuses', [fail()], { discordRefreshToken: 'd1' }],
    [
      'backend refuses the Discord token',
      [ok({ access_token: 'x' }), fail()],
      { discordRefreshToken: 'd1' },
    ],
    [
      'backend JWT undecodable',
      [ok({ access_token: 'x' }), ok({ access_token: 'garbage' })],
      { discordRefreshToken: 'd1' },
    ],
  ])('expires the session when %s', async (_, responses, token) => {
    for (const r of responses) fetch.mockResolvedValueOnce(r)
    expect(await refreshBackendToken(token as JWT)).toMatchObject(EXPIRED)
  })

  it('expires the session when the network throws', async () => {
    fetch.mockRejectedValueOnce(new Error('down'))
    expect(await refreshBackendToken({ backendRefreshToken: 'r1' } as JWT)).toMatchObject(EXPIRED)
  })
})

describe('getServerApiUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['production', undefined, 'http://api:8000'], // NOSONAR typescript:S5332 - asserts the internal swarm URL
    ['production', 'true', 'http://127.0.0.1:8000'],
    ['development', undefined, 'http://127.0.0.1:8000'],
  ])('NODE_ENV=%s DEV_MODE=%s → %s', (env, devMode, expected) => {
    vi.stubEnv('NODE_ENV', env)
    vi.stubEnv('DEV_MODE', devMode)
    vi.stubEnv('API_PORT', undefined)
    expect(getServerApiUrl()).toBe(expected)
  })

  it('takes the port from API_PORT', () => {
    vi.stubEnv('API_PORT', '8010')
    expect(getServerApiUrl()).toMatch(/:8010$/)
  })
})
