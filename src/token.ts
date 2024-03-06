import { SourceLocation } from "./scanner";

export const enum Token {
    BooleanLiteral = 1,
    EOF,
    Identifier,
    Keyword,
    NullLiteral,
    NumericLiteral,
    Punctuator,
    StringLiteral,
    RegularExpression,
    Template,
    JSXIdentifier,
    JSXText
}

export const TokenName: { [key: number]: string } = {};
TokenName[Token.BooleanLiteral] = 'Boolean';
TokenName[Token.EOF] = '<end>';
TokenName[Token.Identifier] = 'Identifier';
TokenName[Token.Keyword] = 'Keyword';
TokenName[Token.NullLiteral] = 'Null';
TokenName[Token.NumericLiteral] = 'Numeric';
TokenName[Token.Punctuator] = 'Punctuator';
TokenName[Token.StringLiteral] = 'String';
TokenName[Token.RegularExpression] = 'RegularExpression';
TokenName[Token.Template] = 'Template';
TokenName[Token.JSXIdentifier] = 'JSXIdentifier';
TokenName[Token.JSXText] = 'JSXText';

// type keywords = 'async' | 'await' | 'class' | 'constructor' | 'delete' | 'for' | 'function' | 'get' | 'if' | 'in' | 'let' | 'new' | 'set' | 'super' | 'target' | 'this' | 'typeof' | 'void' | 'while' | 'with' | 'yield';
// type more = '{' | '(' | '[' | '*' | ':' | ',' | ';' | '=' | '.' | '...' | '*=' | '**=' | '/=' | '%=' | '+=' | '-=' | '<<=' | '>>=' | '>>>=' | '&=' | '^=' | '|=';
// type arithmetic = '+' | '-' | '!' | '~' | '++' | '--' | '/';

/**
 * A string may be a bit imprecise, but we also have to allow for identifiers.
 * A possibility may be to split the value into two fields?
 */
export type ReaderEntry = string | number | null;

export function is_raw_token_value(x: unknown): x is ReaderEntry {
    /* istanbul ignore else */
    if (typeof x === 'string') {
        return true;
    }
    else if (typeof x === 'number') {
        return true;
    }
    else {
        return x === null;
    }
}

export function assert_raw_token_value(x: unknown): ReaderEntry {
    /* istanbul ignore else */
    if (is_raw_token_value(x)) {
        return x;
    }
    else {
        throw new Error(`assert_raw_token_value`);
    }
}

export function as_string(value: ReaderEntry): string {
    /* istanbul ignore else */
    if (typeof value === 'string') {
        return value;
    }
    else {
        throw new Error();
    }
}

export function as_unary_operator(value: ReaderEntry): '+' | '-' | '~' | '!' | 'delete' | 'typeof' | 'void' {
    const operator = as_string(value);
    switch (operator) {
        case '+':
        case '-':
        case '~':
        case '!':
        case 'delete':
        case 'typeof':
        case 'void': {
            return operator;
        }
        /* istanbul ignore next */
        default: {
            throw new Error();
        }
    }
}

export function as_binary_operator(value: ReaderEntry): '+' | '-' | '*' | '/' | '|' | '^' | '**' | '===' | '!==' | '==' | '!=' | '&' | '<' | '>' | '<=' | '>=' | '<<' | '>>' | '||' | '&&' | '??' | '>>>' | '%' | 'in' | 'instanceof' {
    const operator = as_string(value);
    switch (operator) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '|':
        case '^':
        case '**':
        case '&':
        case '<':
        case '>':
        case '<=':
        case '>=':
        case '===':
        case '!==':
        case '==':
        case '!=':
        case '<<':
        case '>>':
        case '||':
        case '&&':
        case '??':
        case '>>>':
        case '%':
        case 'in':
        case 'instanceof': {
            return operator;
        }
        /* istanbul ignore next */
        default: {
            throw new Error(`opr: '${value}'`);
        }
    }
}

// See: https://tc39.es/ecma262/#prod-NotEscapeSequence
export type NotEscapeSequenceHead = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'x' | 'u';

/**
 * Raw tokens are produced by the scanner.ts
 */
export interface RawToken {
    type: Token;
    value: string | number;
    pattern?: string;
    flags?: string;
    regex?: RegExp | null;
    octal?: boolean;
    cooked?: string | null;
    notEscapeSequenceHead?: NotEscapeSequenceHead | null;
    head?: boolean;
    tail?: boolean;
    lineNumber: number;
    lineStart: number;
    start: number;
    end: number;
}

/**
 * RawToken is converted into TokenEntry by the parser.ts convertToken() function.
 * Hence, this could be called a ParserToken.
 * It was also called BufferEntry in esprima.
 */
export interface TokenEntry {
    type: string;
    value: string;
    regex?: {
        pattern: string;
        flags: string;
    };
    range?: [number, number];
    loc?: SourceLocation;
}
