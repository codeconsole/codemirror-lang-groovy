# codemirror-lang-groovy

Groovy language support for [CodeMirror 6](https://codemirror.net/), built on a
[Lezer](https://lezer.codemirror.net/) grammar.

It replaces the stream-based Groovy mode in `@codemirror/legacy-modes` with a
real parser. The editor gets a syntax tree, which brings:

- highlighting that knows a method call from a variable, a declaration from a
  use, and a map key from a property;
- syntax-aware indentation and code folding;
- a tree that other extensions (autocompletion, linting, structural
  navigation) can build on.

## Usage

```js
import {EditorView, basicSetup} from "codemirror"
import {groovy} from "codemirror-lang-groovy"

new EditorView({
  doc: 'println "Hello, Groovy"',
  extensions: [basicSetup, groovy()],
  parent: document.body
})
```

The package exports:

- `groovy()`: the `LanguageSupport` to add to an editor;
- `groovyLanguage`: the `LRLanguage`, for use with other language tooling;
- `parser`: the Lezer parser on its own, which works without CodeMirror.

It depends only on `@codemirror/language`, `@lezer/lr`, `@lezer/highlight` and
`@lezer/common`. When loading CodeMirror through an import map, map
`codemirror-lang-groovy` to `dist/index.js` alongside those modules.

Java and Grails applications can take it from Maven Central as a WebJar,
`org.webjars.npm:codemirror-lang-groovy`, which serves the bundle at
`/webjars/codemirror-lang-groovy/<version>/dist/index.js`:

```groovy
runtimeOnly "org.webjars.npm:codemirror-lang-groovy:0.1.1"
```

## What it parses

The grammar starts from `@lezer/java` and adds the parts of Groovy that Java
lacks:

- statements that end at a line break, with Groovy's rules for when the next
  line continues an expression;
- command calls without parentheses (`println x`, `name nullable: false`)
  and command chains (`id 'groovy' version '4.0' apply false`);
- closures, including parameters, `it`, `{ -> }` and closures passed after a
  call's arguments;
- GStrings with `$name.path` and `${...}` interpolation, triple-quoted, slashy
  (`/re/`) and dollar-slashy (`$/.../$`) strings;
- list and map literals, named arguments and the spread operators;
- `def`, untyped and default-valued parameters, methods named by strings
  (`def "adds two numbers"()`), traits, records and Groovy 4 switch
  expressions;
- the operators `?.`, `*.`, `.@`, `.&`, `?:`, `?=`, `**`, `<=>`, `===`,
  `=~`, `==~`, `in`, `!in`, `as`, `!instanceof` and the range operators.

Against real code it parses without errors 99.1% of the 8,272 Groovy files in
`apache/grails-core`, 99.4% of 2,754 files from other Grails projects, and
562 of 563 Gradle build scripts.

## How it handles Groovy's line-sensitive syntax

Lezer grammars are context-free, and several parts of Groovy are not. Three
small tokenizers in `src/tokens.js` cover them, each following the rule
Groovy's own parser applies (see `GroovyParser.g4` and
`SemanticPredicates.java` in `apache/groovy`):

- **Statement ends.** A zero-width semicolon is inserted at a line break
  unless the next line starts with a token that continues the expression:
  member access (`.`, `?.`), most binary operators, `?`, `:`, assignment, or
  a closure after a call. As in Groovy, a line starting with `+`, `-`, `(` or
  `[` starts a new statement, and a line ending in a comma continues.
- **Command calls.** `a b` is a command call when the name (or the last
  segment of a dotted name) starts with a lowercase letter and is not
  followed by `name =`; otherwise it is a declaration, as in `String name`.
- **Blocks and closures.** Where a statement can start, `{` opens a block,
  unless a parameter list and `->` follow it.

## Known gaps

Rare forms that still produce error nodes:

- a command chain that continues after a call with parentheses or a closure,
  as in `foo(a) bar` or `promise.then { } then { }`;
- `def` combined with a type (`def String name`) and `def final x`;
- a command call that starts a continuation line (`.insertMany docs, opts`).

## Development

```sh
npm install          # also builds dist/
npm run build        # regenerate the parser and bundle
npm test             # grammar, highlighting, language and incremental-parsing tests
npm run corpus -- <dir> [--gradle] [--show 20]
                     # parse every .groovy file under <dir> and list failures
node scripts/parse.js 'println "hi"'
                     # print the syntax tree for a snippet
```

`demo/index.html` shows the grammar next to the legacy mode. Build, then
serve the repository root (for example `python3 -m http.server`) and open
`/demo/`.

`.github/workflows/test.yml` runs the tests on Node 22 and 24 for every push
to `main` and every pull request.

Test cases live in `test/*.txt` in Lezer's test format.
`node scripts/fill-tests.js test/<file>.txt` fills in the expected trees from
the current parser; review every changed tree before committing it.

## Releasing

1. Update `version` in `package.json` and add a `CHANGELOG.md` entry, then
   commit.
2. Tag the commit with that version and push the tag:
   `git tag v0.2.0 && git push origin v0.2.0`.
3. Approve the staged version on npmjs.com, or with
   `npm stage approve <stage-id>`. npm asks for your second factor.

`.github/workflows/release.yml` checks that the tag matches `package.json`,
runs the tests and stages the version on npm. Nothing is installable until
you approve it. Once you do, the workflow has webjars.org deploy the WebJar
to Maven Central, where it can take an hour to appear. The workflow waits up
to five hours for the approval; after that, re-run its `webjar` job.

Publishing uses npm's trusted publishing, so no npm token is stored in the
repository. The package's trusted publisher on npmjs.com is GitHub Actions,
user `codeconsole`, repository `codemirror-lang-groovy`, workflow
`release.yml`, allowed to stage releases only.

## License

MIT. The grammar is derived from
[`@lezer/java`](https://github.com/lezer-parser/java) by Marijn Haverbeke and
others, also MIT licensed.
