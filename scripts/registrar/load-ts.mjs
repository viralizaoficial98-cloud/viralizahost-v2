// Carrega um módulo TypeScript SEM dependências de servidor (ex.: src/lib/registrar/hostinger-catalog.ts)
// para os testes e consultas em Node, transpilando-o com o typescript do projecto.
import ts from 'typescript'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export async function loadTs(relPath) {
  const src = await readFile(join(ROOT, relPath), 'utf8')
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const dir = await mkdtemp(join(tmpdir(), 'vh-ts-'))
  const file = join(dir, 'module.mjs')
  await writeFile(file, out)
  return import(pathToFileURL(file).href)
}
