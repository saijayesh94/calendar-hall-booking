import { readFileSync } from 'node:fs'

// Reads DATABASE_URL etc. from .dev.vars so scripts share the Worker's local secrets.
export function loadDevVars() {
  const vars = {}
  for (const line of readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (m) vars[m[1]] = m[2]
  }
  return { ...vars, ...process.env }
}
