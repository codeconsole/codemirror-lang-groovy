import {parser} from "./parser.js"
import {
  LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, continuedIndent, flatIndent,
  delimitedIndent, foldInside
} from "@codemirror/language"

export {parser}

/**
 * A language provider based on the Lezer Groovy parser, extended with
 * highlighting, indentation and folding information.
 */
export const groovyLanguage = LRLanguage.define({
  name: "groovy",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        IfStatement: continuedIndent({except: /^\s*({|else\b)/}),
        TryStatement: continuedIndent({except: /^\s*({|catch|finally)\b/}),
        LabeledStatement: flatIndent,
        SwitchBlock: context => {
          let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after)
          return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit
        },
        "Block ClassBody EnumBody InterfaceBody ConstructorBody RecordBody AnnotationTypeBody ArrayInitializer":
          delimitedIndent({closing: "}"}),
        // A closure's body is indented one unit, not aligned after its
        // parameters: `list.each { item ->`.
        Closure: delimitedIndent({closing: "}", align: false}),
        "ArgumentList FormalParameters": delimitedIndent({closing: ")"}),
        "ListExpression MapExpression": delimitedIndent({closing: "]"}),
        "BlockComment StringLiteral GString SlashyString DollarSlashyString": () => null,
        Statement: continuedIndent({except: /^\s*{/})
      }),
      foldNodeProp.add({
        ["Block SwitchBlock ClassBody EnumBody InterfaceBody ConstructorBody RecordBody AnnotationTypeBody " +
         "Closure ListExpression MapExpression ArrayInitializer ArgumentList"]: foldInside,
        BlockComment(tree) { return {from: tree.from + 2, to: tree.to - 2} }
      })
    ]
  }),
  languageData: {
    commentTokens: {line: "//", block: {open: "/*", close: "*/"}},
    indentOnInput: /^\s*(?:case |default:|\{|\}|\]|\))$/,
    closeBrackets: {brackets: ["(", "[", "{", "'", '"', "'''", '"""']}
  }
})

/**
 * Groovy language support.
 */
export function groovy() {
  return new LanguageSupport(groovyLanguage)
}
