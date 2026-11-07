// Check the indentation and folding that groovy() adds to the parser.
import {groovy} from "../dist/index.js"
import {EditorState} from "@codemirror/state"
import {getIndentation, foldable, ensureSyntaxTree} from "@codemirror/language"
import assert from "assert"

function state(doc) {
  let s = EditorState.create({doc, extensions: [groovy()]})
  ensureSyntaxTree(s, doc.length, 5000)
  return s
}

// The indentation for a new line inserted where `|` stands.
function indentAt(code) {
  let pos = code.indexOf("|"), doc = code.slice(0, pos) + "\n" + code.slice(pos + 1)
  return getIndentation(state(doc), pos + 1)
}

describe("language support", () => {
  let cases = [
    ["class Book {|\n}", 2],
    ["list.each {|\n}", 2],
    ["list.each { item ->|\n}", 2],
    ["def m = [|\n]", 2],
    ["foo(|\n)", 2],
    ["if (ready)|", 2],
    ["switch (x) {\n  case 1:|\n}", 4],
    ["static constraints = {\n  title blank: false|\n}", 2],
    ["def x = 1|", 0]
  ]
  for (let [code, expected] of cases)
    it(`indents ${JSON.stringify(code)}`, () => assert.equal(indentAt(code), expected))

  it("folds blocks, closures, collections and comments", () => {
    let doc = "class A {\n  def x\n}\nlist.each {\n  it\n}\ndef m = [\n  a: 1\n]\n/*\n note\n*/"
    let s = state(doc), lines = [1, 4, 7, 10].map(n => s.doc.line(n))
    for (let line of lines)
      assert(foldable(s, line.from, line.to), `line ${line.number} should fold`)
    assert(!foldable(s, s.doc.line(2).from, s.doc.line(2).to), "line 2 should not fold")
  })

  it("declares comment tokens and bracket closing", () => {
    let s = state("")
    let data = s.languageDataAt("commentTokens", 0)[0]
    assert.deepEqual(data, {line: "//", block: {open: "/*", close: "*/"}})
    assert(s.languageDataAt("closeBrackets", 0)[0].brackets.includes('"""'))
  })
})
