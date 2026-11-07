// Print the syntax tree for Groovy source given as an argument or on stdin.
//   node scripts/parse.js 'println "hi"'
//   node scripts/parse.js < Script.groovy
import {parser} from "../src/parser.js"
import {readFileSync} from "fs"

let source = process.argv[2] ?? readFileSync(0, "utf8")
let tree = parser.parse(source), out = "", depth = 0
tree.iterate({
  enter(node) {
    if (node.type.isAnonymous && !node.type.isError) return
    let text = node.to - node.from < 30 && !node.node.firstChild ? " " + JSON.stringify(source.slice(node.from, node.to)) : ""
    out += "  ".repeat(depth) + (node.type.isError ? "⚠" : node.name) + text + "\n"
    depth++
  },
  leave(node) { if (!node.type.isAnonymous || node.type.isError) depth-- }
})
process.stdout.write(out)
