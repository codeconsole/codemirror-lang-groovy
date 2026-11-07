import {LRParser} from "@lezer/lr"
import {LRLanguage, LanguageSupport} from "@codemirror/language"

/**
The Lezer parser for Groovy. It can be used without CodeMirror.
*/
export declare const parser: LRParser

/**
A language provider based on the Lezer Groovy parser, extended with
highlighting, indentation and folding information.
*/
export declare const groovyLanguage: LRLanguage

/**
Groovy language support.
*/
export declare function groovy(): LanguageSupport
