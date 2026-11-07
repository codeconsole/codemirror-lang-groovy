// The tokenizers look ahead and behind, so check that reparsing after an
// edit, reusing the previous tree, gives the same tree as parsing afresh.
// Where an edit leaves the code broken, error recovery may legitimately
// differ between the two, so those trees are compared once the code is
// valid again.
import {parser} from "../dist/index.js"
import {TreeFragment} from "@lezer/common"
import assert from "assert"
import * as fs from "fs"
import * as path from "path"
import {fileURLToPath} from "url"

let caseDir = path.dirname(fileURLToPath(import.meta.url))
let samples = []
for (let file of fs.readdirSync(caseDir).sort()) {
  if (!/\.txt$/.test(file)) continue
  for (let [, code] of fs.readFileSync(path.join(caseDir, file), "utf8").matchAll(/# [^\n]*\n([\s\S]*?)\n==>/g))
    samples.push(code.trim())
}

// A small deterministic random number generator, so failures reproduce.
function random(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

let snippets = ["\n", " ", "{", "}", "(", ")", '"', "'", "/", "$", "x", ".", ",", "->", "def ", "\n  .y", "// c\n"]

function edit(tree, text, from, to, insert) {
  let fragments = TreeFragment.applyChanges(TreeFragment.addTree(tree),
                                            [{fromA: from, toA: to, fromB: from, toB: from + insert.length}])
  text = text.slice(0, from) + insert + text.slice(to)
  return {text, tree: parser.parse(text, fragments)}
}

function hasError(tree) {
  let found = false
  tree.iterate({enter(node) { if (node.type.isError) found = true }})
  return found
}

function context(text, pos) {
  return text.slice(Math.max(0, pos - 80), pos + 80)
}

describe("incremental parsing", () => {
  it("restores the original tree when an edit is undone", function () {
    this.timeout(30000)
    let next = random(42)
    for (let text of samples) {
      let original = parser.parse(text), expected = original.toString()
      for (let i = 0; i < 30; i++) {
        let from = Math.floor(next() * text.length)
        let to = next() < 0.5 ? from : Math.min(text.length, from + 1 + Math.floor(next() * 4))
        let insert = next() < 0.6 ? snippets[Math.floor(next() * snippets.length)] : ""
        let edited = edit(original, text, from, to, insert)
        let undone = edit(edited.tree, edited.text, from, from + insert.length, text.slice(from, to))
        assert.equal(undone.text, text)
        if (undone.tree.toString() != expected)
          assert.fail(`Undoing an edit at ${from} did not restore the tree of\n${text}`)
      }
    }
  })

  it("matches a fresh parse after edits that keep the code valid", function () {
    this.timeout(30000)
    let next = random(7), checked = 0
    for (let sample of samples) {
      let text = sample, tree = parser.parse(text)
      for (let i = 0; i < 60; i++) {
        let from = Math.floor(next() * text.length)
        let to = next() < 0.5 ? from : Math.min(text.length, from + Math.floor(next() * 4))
        let insert = next() < 0.6 ? snippets[Math.floor(next() * snippets.length)] : ""
        let result = edit(tree, text, from, to, insert)
        let fresh = parser.parse(result.text)
        if (hasError(fresh)) continue
        text = result.text
        tree = result.tree
        checked++
        if (tree.toString() != fresh.toString())
          assert.fail(`An edit at ${from} parsed differently incrementally in\n${text}`)
      }
    }
    assert(checked > 500, `only ${checked} edits kept the code valid`)
  })
})
