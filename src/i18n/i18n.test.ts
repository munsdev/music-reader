import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { de } from './de'
import { en } from './en'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v as object, `${prefix}${k}.`),
  )
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx?$/.test(f) && !f.endsWith('.test.ts')
        ? [p]
        : []
  })
}

describe('translations', () => {
  const enKeys = new Set(keys(en).map((k) => k.replace(/_(one|other)$/, '')))
  const deKeys = new Set(keys(de).map((k) => k.replace(/_(one|other)$/, '')))

  it('German has every English key', () => {
    expect([...enKeys].filter((k) => !deKeys.has(k))).toEqual([])
  })

  it('every static key used in the code exists', () => {
    const used = files('src').flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9]+\.[a-zA-Z0-9_.-]+)'/g)].map(
        (m) => m[1]!,
      ),
    )
    expect([...new Set(used)].filter((k) => !enKeys.has(k))).toEqual([])
  })

  it('has no em dashes or en dashes', () => {
    const all = [...keys(en).map((k) => k), JSON.stringify(en), JSON.stringify(de)].join('')
    expect(all).not.toMatch(/[–—]/)
  })
})
