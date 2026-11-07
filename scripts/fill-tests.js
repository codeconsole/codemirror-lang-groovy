// Fill in or refresh the expected trees in test/*.txt from the current
// parser, in the format Lezer's fileTests reads (punctuation left out).
// Review every changed tree before committing it.
//   node scripts/fill-tests.js test/strings.txt
import {parser} from "../src/parser.js"
import {readFileSync, writeFileSync} from "fs"

function print(cursor) {
  let name = cursor.type.isError ? "⚠" : cursor.name, children = []
  if (cursor.firstChild()) {
    do {
      if (cursor.type.isError || !/\W/.test(cursor.name)) children.push(print(cursor))
    } while (cursor.nextSibling())
    cursor.parent()
  }
  return children.length ? `${name}(${children.join(",")})` : name
}

for (let file of process.argv.slice(2)) {
  let text = readFileSync(file, "utf8")
  let out = text.replace(/(# [^\n]*\n)([\s\S]*?)\n==>[^\n]*\n[\s\S]*?(?=\n# |$)/g, (_, header, code) => {
    return `${header}${code}\n==>\n\n${print(parser.parse(code.trim()).cursor())}\n\n`
  })
  writeFileSync(file, out.replace(/\n+$/, "\n"))
}
