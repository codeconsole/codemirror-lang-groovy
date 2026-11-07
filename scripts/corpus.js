// Parse every .groovy (and .gradle) file under the given directories and
// report the files that produce error nodes, with the first error's line.
// Arguments may also name individual files.
//   node scripts/corpus.js ~/src/grails-core [--show 20] [--gradle]
import {parser} from "../src/parser.js"
import {readFileSync, readdirSync, statSync} from "fs"
import {join} from "path"

let args = process.argv.slice(2), show = 20, gradle = false, dirs = []
for (let i = 0; i < args.length; i++) {
  if (args[i] == "--show") show = +args[++i]
  else if (args[i] == "--gradle") gradle = true
  else dirs.push(args[i])
}

function* files(dir) {
  for (let name of readdirSync(dir)) {
    if (name == "node_modules" || name == "build" || name.startsWith(".")) continue
    let path = join(dir, name), stat = statSync(path)
    if (stat.isDirectory()) yield* files(path)
    else if (/\.groovy$/.test(name) || gradle && /\.gradle$/.test(name)) yield path
  }
}

let total = 0, failing = [], errorCount = 0, bytes = 0, start = Date.now()
function* inputs(path) {
  if (statSync(path).isDirectory()) yield* files(path)
  else yield path
}

for (let dir of dirs) for (let path of inputs(dir)) {
  let source = readFileSync(path, "utf8"), errors = []
  total++
  bytes += source.length
  parser.parse(source).iterate({enter(node) { if (node.type.isError) errors.push(node.from) }})
  if (errors.length) {
    errorCount += errors.length
    let line = source.slice(0, errors[0]).split("\n").length
    failing.push({path, count: errors.length, line, text: source.split("\n")[line - 1].trim()})
  }
}
let seconds = (Date.now() - start) / 1000
console.log(`${total} files, ${(bytes / 1e6).toFixed(1)} MB in ${seconds.toFixed(1)}s; ` +
            `${total - failing.length} parse cleanly (${(100 * (total - failing.length) / total).toFixed(1)}%), ` +
            `${failing.length} with errors (${errorCount} error nodes)`)
failing.sort((a, b) => b.count - a.count)
for (let f of failing.slice(0, show)) console.log(`${f.count}\t${f.path}:${f.line}\t${f.text.slice(0, 100)}`)
