// Check the highlighting tags assigned to the parts of Groovy that the
// grammar adds to Java.
import {groovyLanguage} from "../dist/index.js"
import {highlightTree, tagHighlighter, tags as t} from "@lezer/highlight"
import assert from "assert"

const classes = [
  [t.keyword, "kw"], [t.controlKeyword, "kw"], [t.definitionKeyword, "kw"], [t.operatorKeyword, "kw"],
  [t.moduleKeyword, "kw"], [t.modifier, "kw"], [t.self, "kw"],
  [t.string, "str"], [t.escape, "esc"], [t.special(t.brace), "interp"],
  [t.special(t.variableName), "interpVar"], [t.propertyName, "prop"],
  [t.function(t.variableName), "fn"], [t.definition(t.variableName), "def"],
  [t.typeName, "type"], [t.variableName, "var"], [t.annotation, "ann"], [t.comment, "comment"],
  [t.number, "num"], [t.bool, "bool"], [t.labelName, "label"], [t.meta, "meta"]
]
const highlighter = tagHighlighter(classes.map(([tag, cls]) => ({tag, class: cls})))

// Return the class assigned to each occurrence of `word` in `code`.
function styleOf(code, word, occurrence = 0) {
  let tree = groovyLanguage.parser.parse(code), at = -1
  for (let i = 0; i <= occurrence; i++) at = code.indexOf(word, at + 1)
  let found = null
  highlightTree(tree, highlighter, (from, to, cls) => {
    if (from <= at && to >= at + word.length) found = cls
  })
  return found
}

describe("highlighting", () => {
  let cases = [
    ['println "hi"', "println", "fn"],
    ['log.info "hi"', "info", "fn"],
    ['def x = 1', "def", "kw"],
    ['def x = 1', "x", "def"],
    ['String name', "String", "type"],
    ['a?.b', "b", "prop"],
    ['service.package.name', "package", "prop"],
    ['map.byte(0)', "byte", "fn"],
    ['[class: "btn"]', "class", "prop"],
    ['render view: "x"', "view", "prop"],
    ['"a $b c"', "$b", "interpVar"],
    ['"a ${b} c"', "${", "interp"],
    ['"a ${b} c"', "b", "var"],
    ['"tab\\t"', "\\t", "esc"],
    ['def r = /\\d+/', "/\\d+/", "str"],
    ['def r = $/x/$', "$/x/$", "str"],
    ['x as String', "as", "kw"],
    ['x in list', "in", "kw"],
    ['@CompileStatic class A {}', "CompileStatic", "ann"],
    ['given: x', "given", "label"],
    ['def "adds numbers"() {}', '"adds numbers"', "str"],
    ['trait T {}', "trait", "kw"],
    ['#!/usr/bin/env groovy', "#!/usr/bin/env groovy", "meta"],
    ['def n = 1G', "1G", "num"]
  ]
  for (let [code, word, cls] of cases)
    it(`styles ${word} in ${code}`, () => assert.equal(styleOf(code, word), cls))
})
