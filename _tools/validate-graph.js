// validate-graph.js  (run with: node validate-graph.js)
import { readFileSync } from 'fs'
import { glob } from 'glob'
import matter from 'gray-matter'
import { z } from 'zod'

// --- Schema ---

const STATUS = z.enum(['draft', 'reviewed', 'adopted', 'deprecated', 'obsolete'])
const IDS = z.union([z.string(), z.array(z.string())]).optional()
  .transform(v => v == null ? [] : Array.isArray(v) ? v : [v])

const SCHEMAS = {
  statements: z.object({ id: z.string(), title: z.string(), status: STATUS, outcomes: IDS }),
  outcomes:   z.object({ id: z.string(), title: z.string(), status: STATUS, statement: z.string(), outputs: IDS }),
  outputs:    z.object({ id: z.string(), title: z.string(), status: STATUS, outcome: z.string(),   activities: IDS }),
  activities: z.object({ id: z.string(), title: z.string(), status: STATUS, output: z.string(),    inputs: IDS }),
  inputs:     z.object({ id: z.string(), title: z.string(), status: STATUS, activity: z.string() }),
}

// Relationship fields to traverse when checking references
const REF_FIELDS = ['outcomes', 'outputs', 'activities', 'inputs', 'statement', 'outcome', 'output', 'activity']

// --- Load ---

const errors = []
const index = new Map()  // id → { file, data }

const files = await glob('{statements,outcomes,outputs,activities,inputs}/*.md')

for (const file of files) {
  const { data } = matter(readFileSync(file, 'utf8'))
  const level = file.split('/')[0]

  // Schema validation
  const result = SCHEMAS[level]?.safeParse(data)
  if (!result?.success) {
    for (const issue of result.error.issues)
      errors.push({ file, msg: `${issue.path.join('.')}: ${issue.message}` })
    continue
  }

  const fm = result.data
  if (index.has(fm.id))
    errors.push({ file, msg: `duplicate ID '${fm.id}' (also in ${index.get(fm.id).file})` })
  else
    index.set(fm.id, { file, level, fm })
}

// --- Reference resolution ---

for (const { file, fm } of index.values()) {
  for (const field of REF_FIELDS) {
    const refs = Array.isArray(fm[field]) ? fm[field] : fm[field] ? [fm[field]] : []
    for (const ref of refs) {
      if (!index.has(ref))
        errors.push({ file, msg: `'${field}' references unknown id '${ref}'` })
    }
  }
}

// --- Bidirectional consistency ---
// If outcome says statement: s1, verify s1.outcomes includes outcome's id

for (const { file, level, fm } of index.values()) {
  if (level === 'outcomes' && fm.statement) {
    const parent = index.get(fm.statement)
    if (parent && !parent.fm.outcomes.includes(fm.id))
      errors.push({ file, msg: `'${fm.statement}' does not list '${fm.id}' in its outcomes` })
  }
  if (level === 'outputs' && fm.outcome) {
    const parent = index.get(fm.outcome)
    if (parent && !parent.fm.outputs.includes(fm.id))
      errors.push({ file, msg: `'${fm.outcome}' does not list '${fm.id}' in its outputs` })
  }
  if (level === 'activities' && fm.output) {
    const parent = index.get(fm.output)
    if (parent && !parent.fm.activities.includes(fm.id))
      errors.push({ file, msg: `'${fm.output}' does not list '${fm.id}' in its activities` })
  }
  if (level === 'inputs' && fm.activity) {
    const parent = index.get(fm.activity)
    if (parent && !parent.fm.inputs.includes(fm.id))
      errors.push({ file, msg: `'${fm.activity}' does not list '${fm.id}' in its inputs` })
  }
}

// --- Report ---

if (errors.length) {
  console.error(`\n${errors.length} error(s) found:\n`)
  // Group by file for readability
  const byFile = Map.groupBy(errors, e => e.file)
  for (const [file, errs] of byFile)
    errs.forEach(e => console.error(`  ${file}\n    ✗ ${e.msg}`))
  process.exit(1)
} else {
  console.log(`✓ Graph valid — ${index.size} elements across ${files.length} files`)
}
