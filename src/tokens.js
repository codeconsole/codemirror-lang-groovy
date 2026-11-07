// Hand-written tokenizers for the parts of Groovy's syntax that depend on
// line breaks and on what follows a name, which Lezer's built-in tokenizer
// cannot express.

import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {
  insertSemi, commandStart, blockOpen, shiftOp, statementSwitch, whitespace, lineContinuation,
  LineComment, BlockComment, Shebang
} from "./parser.terms.js"

const tab = 9, newlineChar = 10, verticalTab = 11, formFeed = 12, carriageReturn = 13, space = 32,
      bang = 33, doubleQuote = 34, dollar = 36, percent = 37, ampersand = 38, singleQuote = 39,
      parenL = 40, parenR = 41, star = 42, plus = 43, comma = 44, minus = 45, dot = 46, slash = 47, colon = 58,
      semicolon = 59, lessThan = 60, equals = 61, greaterThan = 62, question = 63, at = 64,
      bracketL = 91, backslash = 92, bracketR = 93, caret = 94, underscore = 95, braceL = 123, pipe = 124,
      braceR = 125, tilde = 126

// Words that cannot name a command call's method, or start its argument.
const reserved = new Set([
  "abstract", "as", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
  "const", "continue", "def", "default", "do", "double", "else", "enum", "extends", "false",
  "final", "finally", "float", "for", "goto", "if", "implements", "import", "in", "instanceof",
  "int", "interface", "long", "native", "new", "non", "null", "package", "permits", "private",
  "protected", "public", "record", "return", "sealed", "short", "static", "strictfp", "super",
  "switch", "synchronized", "this", "threadsafe", "throw", "throws", "trait", "transient",
  "true", "try", "var", "void", "volatile", "while", "yield"
])

// Reserved words that may still start an argument, as in `println new Date()`.
const argumentWords = new Set(["new", "this", "super", "null", "true", "false"])

function isHorizontalSpace(ch) {
  return ch == space || ch == tab || ch == verticalTab || ch == formFeed || ch == 0xa0 ||
    ch == 0x1680 || ch >= 0x2000 && ch <= 0x200a || ch == 0x202f || ch == 0x205f ||
    ch == 0x3000 || ch == 0xfeff
}

function isNewline(ch) {
  return ch == newlineChar || ch == carriageReturn || ch == 0x2028 || ch == 0x2029
}

function isIdentifierStart(ch) {
  return ch >= 97 && ch <= 122 || ch >= 65 && ch <= 90 || ch == underscore || ch == dollar || ch >= 0xa1
}

function isIdentifierChar(ch) {
  return isIdentifierStart(ch) || ch >= 48 && ch <= 57
}

function isDigit(ch) {
  return ch >= 48 && ch <= 57
}

function isUpperCase(ch) {
  return ch >= 65 && ch <= 90
}

// Read the identifier starting at `pos`, or return the empty string.
function readWord(input, pos) {
  let word = ""
  if (!isIdentifierStart(input.peek(pos))) return word
  for (let ch; isIdentifierChar(ch = input.peek(pos)); pos++) word += String.fromCharCode(ch)
  return word
}

function wordAt(input, pos, word) {
  for (let i = 0; i < word.length; i++)
    if (input.peek(pos + i) != word.charCodeAt(i)) return false
  return !isIdentifierChar(input.peek(pos + word.length))
}

// Tracks whether the last token was whitespace or a comment. The semicolon
// tokenizer decides only at the end of a real token, where it can see what
// came before; at later positions in the same gap it leaves that decision
// standing.
export const trackSkipped = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == whitespace || term == lineContinuation || term == LineComment || term == BlockComment ||
      term == Shebang
  },
  // A node taken over from a previous parse ends in a real token.
  reuse() { return false },
  strict: false
})

// Whether a token starting at `pos`, at the beginning of a line, carries on
// the expression from the line before instead of starting a new statement.
// This follows where Groovy's grammar allows a newline before an operator:
// member access, most binary operators, the ternary and elvis operators,
// assignment, a closure passed to a call, and a method's `throws` clause.
// A line starting with `+`, `-`,
// `**`, `(` or `[` starts a new statement, as it does in Groovy. So does `<`,
// which in practice opens a generic method declaration.
function continuesExpression(input, pos) {
  let ch = input.peek(pos), next = input.peek(pos + 1)
  switch (ch) {
    case dot: case question: case percent: case ampersand: case pipe: case caret: case colon: case equals:
    case greaterThan:
      return true
    case slash:
      // Groovy reads a `/` that closes on the same line as a slashy string.
      return !closesOnLine(input, pos + 1)
    case star:
      return next != star
    case bang:
      return next == equals || wordAt(input, pos + 1, "in") || wordAt(input, pos + 1, "instanceof")
    case minus:
      return next == greaterThan || next == equals
    case plus:
      return next == equals
    case braceL: {
      // `foo()\n{ ... }` passes the closure to the call.
      let prev = input.peek(-1)
      return prev == parenR || isIdentifierChar(prev)
    }
    default:
      return wordAt(input, pos, "in") || wordAt(input, pos, "as") || wordAt(input, pos, "instanceof") ||
        wordAt(input, pos, "throws")
  }
}

// Whether an unescaped `/` follows before the end of the line.
function closesOnLine(input, pos) {
  for (let ch; (ch = input.peek(pos)) != -1 && !isNewline(ch); pos++) {
    if (ch == backslash) pos++
    else if (ch == slash) return true
  }
  return false
}

// Supplies the semicolon that ends a statement at a line break, before a
// closing brace or `else`, and at the end of the input.
export const insertSemicolon = new ExternalTokenizer((input, stack) => {
  if (stack.context || !stack.canShift(insertSemi)) return
  // A single-line string left unterminated ends at the line break, which it
  // consumes, so that line break is visible only behind the current position.
  let pos = 0, sawNewline = isNewline(input.peek(-1))
  for (;;) {
    let ch = input.peek(pos)
    if (isHorizontalSpace(ch)) {
      pos++
    } else if (ch == backslash && isNewline(input.peek(pos + 1))) {
      // A line continuation joins the lines.
      pos += input.peek(pos + 1) == carriageReturn && input.peek(pos + 2) == newlineChar ? 3 : 2
    } else if (isNewline(ch)) {
      sawNewline = true
      pos++
    } else if (ch == slash && input.peek(pos + 1) == slash) {
      pos += 2
      while (input.peek(pos) != -1 && !isNewline(input.peek(pos))) pos++
    } else if (ch == slash && input.peek(pos + 1) == star) {
      pos += 2
      for (;;) {
        let c = input.peek(pos)
        if (c == -1) break
        if (c == star && input.peek(pos + 1) == slash) { pos += 2; break }
        if (isNewline(c)) sawNewline = true
        pos++
      }
    } else {
      break
    }
  }
  let next = input.peek(pos)
  if (next == semicolon) return
  if (next == -1 || next == braceR) {
    input.acceptToken(insertSemi)
  } else if (sawNewline) {
    // A line ending in a comma, or in the brace that opens an enum's
    // constants, continues on the next one.
    let prev = input.peek(-1)
    if (prev != comma && prev != braceL && !continuesExpression(input, pos)) input.acceptToken(insertSemi)
  } else if (wordAt(input, pos, "else")) {
    input.acceptToken(insertSemi)
  }
}, {contextual: true})

// Whether `name:` (not `name::`) starts at `pos`.
function namedArgumentAt(input, pos) {
  let word = readWord(input, pos)
  if (!word) return false
  pos += word.length
  while (isHorizontalSpace(input.peek(pos))) pos++
  return input.peek(pos) == colon && input.peek(pos + 1) != colon
}

// Skip the single-line string starting at `pos` and return the position
// after it, or -1 if it does not close on the line.
function skipString(input, pos) {
  let quote = input.peek(pos)
  for (pos++;; pos++) {
    let ch = input.peek(pos)
    if (ch == -1 || isNewline(ch)) return -1
    if (ch == backslash) pos++
    else if (ch == quote) return pos + 1
  }
}

// Skip the bracketed group starting at `pos`, along with any strings in it,
// and return the position after it, or -1 if it does not close within a
// reasonable distance.
function skipBalanced(input, pos) {
  let depth = 0
  for (let end = pos + 2000; pos < end;) {
    let ch = input.peek(pos++)
    if (ch == -1) return -1
    if (ch == parenL || ch == bracketL || ch == braceL) {
      depth++
    } else if (ch == parenR || ch == bracketR || ch == braceR) {
      if (--depth == 0) return pos
    } else if (ch == singleQuote || ch == doubleQuote) {
      for (let c; (c = input.peek(pos)) != ch; pos++) {
        if (c == -1 || isNewline(c)) return -1
        if (c == backslash) pos++
      }
      pos++
    }
  }
  return -1
}

// Marks the start of a command call, a method call without parentheses such
// as `println x` or `name nullable: false`, using the rule Groovy's parser
// applies to `a b`: it is a command call when the first name (or the last
// segment of a dotted name) starts with a lowercase letter and is not
// followed by `name =`, and a declaration otherwise, as in `String name`.
export const commandCall = new ExternalTokenizer((input, stack) => {
  if (!stack.canShift(commandStart)) return
  let start = input.next
  if (start == singleQuote || start == doubleQuote) {
    // A string names the method when named arguments follow it, as in the
    // Grails constraint `'*' nullable: true`.
    let end = skipString(input, 0)
    if (end < 0 || !isHorizontalSpace(input.peek(end))) return
    while (isHorizontalSpace(input.peek(end))) end++
    if (namedArgumentAt(input, end)) input.acceptToken(commandStart)
    return
  }
  let first = "", last = "", pos = 0, segments = 1
  if (start == parenL) {
    // `((Validator) validator).validate target, errors`
    pos = skipBalanced(input, 0)
    if (pos < 0 || input.peek(pos) != dot) return
  } else if (isIdentifierStart(start)) {
    first = last = readWord(input, 0)
    pos = first.length
  } else {
    return
  }
  if (first == "new") {
    // `new Book(title: 'x').save flush: true`
    while (isHorizontalSpace(input.peek(pos))) pos++
    let type = readWord(input, pos)
    if (!type) return
    pos += type.length
    while (input.peek(pos) == dot && isIdentifierStart(input.peek(pos + 1))) {
      let part = readWord(input, pos + 1)
      pos += 1 + part.length
    }
    if (input.peek(pos) != parenL) return
  } else if (reserved.has(first) && first != "this" && first != "super") {
    return
  }
  for (;;) {
    // A call or index along the way, as in `a.b().c d` or `a[0].b c`, must
    // be followed by a dot.
    while (input.peek(pos) == parenL || input.peek(pos) == bracketL) {
      pos = skipBalanced(input, pos)
      if (pos < 0) return
    }
    let ch = input.peek(pos), next = input.peek(pos + 1), opLength = 0
    if (ch == dot && next != dot && next != ampersand) opLength = next == at ? 2 : 1
    else if ((ch == question || ch == star) && next == dot) opLength = 2
    if (!opLength) break
    let word = readWord(input, pos + opLength)
    if (!word) return
    pos += opLength + word.length
    last = word
    segments++
  }
  let prev = input.peek(pos - 1)
  if (prev == parenR || prev == bracketR || !last) return
  if (segments == 1 && (first == "this" || first == "super" || first == "new")) return
  // A string argument may follow the name directly: `render"..."`.
  let ch = input.peek(pos)
  if (!isHorizontalSpace(ch) && ch != singleQuote && ch != doubleQuote) return
  while (isHorizontalSpace(input.peek(pos))) pos++
  // A capitalized name starts a declaration, `String name`, unless a named
  // argument follows it, as in a constraint on a capitalized property:
  // `SKU nullable: true`.
  if (isUpperCase(last.charCodeAt(0)) && !namedArgumentAt(input, pos)) return

  ch = input.peek(pos)
  if (isIdentifierStart(ch)) {
    let word = readWord(input, pos), after = pos + word.length
    while (isHorizontalSpace(input.peek(after))) after++
    // A reserved word may still name an argument: `link class: 'btn'`.
    if (reserved.has(word) && !argumentWords.has(word) && !namedArgumentAt(input, pos)) return
    // `foo bar = 1` declares `bar` with the type `foo`.
    if (input.peek(after) == equals && input.peek(after + 1) != equals && input.peek(after + 1) != tilde) return
  } else if (ch == bang) {
    if (input.peek(pos + 1) == equals) return
    if (wordAt(input, pos + 1, "in") || wordAt(input, pos + 1, "instanceof")) return
  } else if (!(ch == singleQuote || ch == doubleQuote || ch == tilde || isDigit(ch))) {
    return
  }
  input.acceptToken(commandStart)
}, {contextual: true})

// Whether the `{` at the current position opens a closure with a parameter
// list, `{ -> ...}` or `{ String a, b -> ... }`.
function hasClosureParameters(input) {
  for (let pos = 1; pos < 500; pos++) {
    let ch = input.peek(pos)
    if (ch == minus) return input.peek(pos + 1) == greaterThan
    if (!(isIdentifierChar(ch) || isHorizontalSpace(ch) || isNewline(ch) || ch == comma || ch == dot ||
          ch == lessThan || ch == greaterThan || ch == bracketL || ch == bracketR || ch == question ||
          ch == ampersand || ch == at)) return false
  }
  return false
}

// A `{` where a block can start opens a block, even where a closure could
// also start, as at the beginning of a statement, unless a parameter list
// and `->` follow it. Everywhere else the main tokenizer reads it as the `{`
// of a closure, class body or array initializer.
export const blockBrace = new ExternalTokenizer((input, stack) => {
  if (input.next == braceL && stack.canShift(blockOpen) && !hasClosureParameters(input))
    input.acceptToken(blockOpen, 1)
}, {contextual: true})

// `>>` and `>>>` are read as shift operators only where one can appear, so
// that nested type arguments such as `List<Map<String, Object>>` close with
// two `>` tokens.
export const shiftOperator = new ExternalTokenizer((input, stack) => {
  if (input.next != greaterThan || input.peek(1) != greaterThan || !stack.canShift(shiftOp)) return
  let length = input.peek(2) == greaterThan ? 3 : 2
  // `>>=` and `>>>=` are assignment operators.
  if (input.peek(length) != equals) input.acceptToken(shiftOp, length)
}, {contextual: true})

// `switch` where a statement can start begins a switch statement; elsewhere
// it begins a switch expression.
export const switchKeyword = new ExternalTokenizer((input, stack) => {
  if (wordAt(input, 0, "switch") && stack.canShift(statementSwitch)) input.acceptToken(statementSwitch, 6)
}, {contextual: true})
