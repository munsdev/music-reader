// Collects licenses of production dependencies into src/generated/licenses.json
// for the in-app "Open-source licenses" screen. Runs before every build.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const raw = execFileSync(
  'npx',
  ['license-checker-rseidelsohn', '--production', '--json', '--excludePrivatePackages'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
const data = JSON.parse(raw)
// Copyleft and non-commercial licenses are not allowed (see CLAUDE.md). Dual licenses offering MIT are fine.
const banned = /\b(A?GPL|LGPL|SSPL|BUSL)\b|-NC\b|-ND\b/i
const entries = Object.entries(data)
  .map(([id, info]) => {
    const at = id.lastIndexOf('@')
    let text = ''
    try {
      if (info.licenseFile) text = readFileSync(info.licenseFile, 'utf8').slice(0, 20000)
    } catch {}
    return {
      name: id.slice(0, at),
      version: id.slice(at + 1),
      license: String(info.licenses),
      repository: info.repository ?? '',
      text,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const problems = entries.filter(
  (e) =>
    banned.test(e.license) &&
    !/\bOR\b[^)]*\b(MIT|Apache|BSD)|\b(MIT|Apache|BSD)[^)]*\bOR\b/i.test(e.license),
)
if (problems.length) {
  console.error('Disallowed licenses:', problems.map((p) => `${p.name} (${p.license})`).join(', '))
  process.exit(1)
}
mkdirSync('src/generated', { recursive: true })
writeFileSync('src/generated/licenses.json', JSON.stringify(entries))
console.log(`licenses.json: ${entries.length} packages`)
