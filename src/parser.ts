/* eslint-disable @typescript-eslint/unbound-method */
import { assert } from './assert';
import { ErrorHandler } from './error-handler';
import { ParseDelegate, ParseOptions } from './esprima';
import { Messages } from './messages';
import { Node } from './node';
import { ArgumentListElement, ArrayExpression, ArrayExpressionElement, ArrayPattern, ArrayPatternElement, ArrowFunctionExpression, ArrowParameterPlaceHolder, assert_function_parameters, AssignmentExpression, AssignmentPattern, AsyncArrowFunctionExpression, AsyncFunctionDeclaration, AwaitExpression, BaseNode, BinaryExpression, BindingIdentifier, BindingPattern, BlockStatement, BreakStatement, CallExpression, CatchClause, ChainElement, ChainExpression, ClassBody, ClassDeclaration, ClassExpression, ConditionalExpression, ContinueStatement, DebuggerStatement, Directive, DoWhileStatement, EmptyStatement, ExportAllDeclaration, ExportDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, ExportSpecifier, Expression, ExpressionStatement, ForInStatement, ForOfStatement, ForStatement, FunctionDeclaration, FunctionExpression, FunctionParameter, Identifier, IfStatement, Import, ImportDeclaration, ImportDeclarationSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier, is_array_expression, is_array_pattern, is_arrow_parameter_placeholder, is_assignment_expression, is_assignment_pattern, is_identifier, is_literal, is_member_expression, is_object_expression, is_object_pattern, is_rest_element, is_sequence_expression, is_spread_element, is_unary_expression, is_yield_expression, LabeledStatement, Literal, MemberExpression, MetaProperty, MethodDefinition, Module, NewExpression, ObjectExpression, ObjectExpressionProperty, ObjectPattern, ObjectPatternProperty, Property, PropertyKey, PropertyValue, RegexLiteral, RestElement, ReturnStatement, Script, SequenceExpression, SpreadElement, Statement, StatementListItem, Super, SwitchCase, SwitchStatement, TaggedTemplateExpression, TemplateElement, TemplateLiteral, ThisExpression, ThrowStatement, TryStatement, UnaryExpression, UpdateExpression, VariableDeclaration, VariableDeclarator, WhileStatement, WithStatement, YieldExpression } from './nodes';
import { Comment, RawToken, RawTokenValue, Scanner, SourceLocation } from './scanner';
import { Syntax } from './syntax';
import { assert_raw_token_value, as_binary_operator, as_string, as_unary_operator, Token, TokenName } from './token';

interface MutableNode {
    type: string;
    name: string;
    operator?: string;
    argument?: unknown;
    delegate?: boolean;
}

interface Config {
    range: boolean;
    loc: boolean;
    source: string | null;
    tokens: boolean;
    comment: boolean;
    tolerant: boolean;
}

interface Context {
    isModule: boolean;
    allowIn: boolean;
    allowStrictDirective: boolean;
    allowYield: boolean;
    isAsync: boolean;
    firstCoverInitializedNameError: RawToken | null;
    isAssignmentTarget: boolean;
    isBindingElement: boolean;
    inFunctionBody: boolean;
    inIteration: boolean;
    inSwitch: boolean;
    inClassConstructor: boolean;
    labelSet: { [key: string]: boolean };
    strict: boolean;
}

type Param = ArrayPattern | AssignmentPattern | ObjectPattern | RestElement;

interface FormalParameters {
    firstRestricted?: RawToken;
    hasDuplicateParameterNames?: boolean;
    simple: boolean;
    params: FunctionParameter[];
    paramSet?: { [key: string]: boolean };
    stricted?: RawToken;
    message?: string;
}

export interface Marker {
    index: number;
    line: number;
    column: number;
}

export interface MetaData {
    start: {
        line: number;
        column: number;
        offset: number;
    };
    end: {
        line: number;
        column: number;
        offset: number;
    };
}

export class BlockComment extends BaseNode {
    constructor(readonly value: string) {
        super(Syntax.BlockComment);
    }
}

export function is_block_comment(node: Node): node is BlockComment {
    return node.type == Syntax.BlockComment;
}

export class LineComment extends BaseNode {
    constructor(readonly value: string) {
        super(Syntax.LineComment);
    }
}

export function is_line_comment(node: Node): node is LineComment {
    return node.type === Syntax.LineComment;
}

function create_comment_node(multiline: boolean, value: string): BlockComment | LineComment {
    if (multiline) {
        return new BlockComment(value);
    }
    else {
        return new LineComment(value);
    }
}

interface DeclarationOptions {
    inFor: boolean;
}

interface TokenEntry {
    type: string;
    value: string;
    regex?: {
        pattern: string;
        flags: string;
    };
    range?: [number, number];
    loc?: SourceLocation;
}

interface ParseTemplateLiteralOptions {
    isTagged: boolean;
}

const PrecedenceTable = {
    ')': 0,
    ';': 0,
    ',': 0,
    '=': 0,
    ']': 0,
    '??': 5,
    '||': 6,
    '&&': 7,
    '|': 8,
    '^': 9,
    '&': 10,
    '==': 11,
    '!=': 11,
    '===': 11,
    '!==': 11,
    '<': 12,
    '>': 12,
    '<=': 12,
    '>=': 12,
    '<<': 13,
    '>>': 13,
    '>>>': 13,
    '+': 14,
    '-': 14,
    '*': 15,
    '/': 15,
    '%': 15
} as const;

export type PrecedenceOperator = ')' | ';' | ',' | '=' | ']' | '??' | '||' | '&&' | '|' | '^' | '&' | '==' | '!=' | '===' | '!==' | '<' | '>' | '<=' | '>=' | '<<' | '>>' | '>>>' | '+' | '-' | '*' | '/' | '%';

function shallow_copy<T extends object>(source: T): T {
    return {
        ...source,
    }
}

export class Parser {
    readonly config: Config;
    readonly delegate?: ParseDelegate | null;
    readonly errorHandler: ErrorHandler;
    readonly scanner: Scanner;
    readonly operatorPrecedence: { [operator: string]: number };

    lookahead: RawToken;
    hasLineTerminator: boolean;

    context: Context;
    tokens: TokenEntry[];
    startMarker: Marker;
    lastMarker: Marker;

    constructor(code: string, options: ParseOptions = {}, delegate?: ParseDelegate | null) {
        this.config = {
            range: (typeof options.range === 'boolean') && options.range,
            loc: (typeof options.loc === 'boolean') && options.loc,
            source: null,
            tokens: (typeof options.tokens === 'boolean') && options.tokens,
            comment: (typeof options.comment === 'boolean') && options.comment,
            tolerant: (typeof options.tolerant === 'boolean') && options.tolerant
        };
        if (this.config.loc && options.source && options.source !== null) {
            this.config.source = String(options.source);
        }

        this.delegate = delegate;

        this.errorHandler = new ErrorHandler();
        this.errorHandler.tolerant = this.config.tolerant;
        this.scanner = new Scanner(code, this.errorHandler);
        this.scanner.trackComment = this.config.comment;

        this.operatorPrecedence = shallow_copy(PrecedenceTable);

        if (options.operatorPrecedence) {
            const operators = Object.keys(this.operatorPrecedence);
            for (const operator of operators) {
                const override = options.operatorPrecedence(operator as PrecedenceOperator);
                if (typeof override === 'number') {
                    this.operatorPrecedence[operator] = override;
                }
            }
        }

        this.lookahead = {
            type: Token.EOF,
            value: '',
            lineNumber: this.scanner.lineNumber,
            lineStart: 0,
            start: 0,
            end: 0
        };
        this.hasLineTerminator = false;

        this.context = {
            isModule: false,
            isAsync: false,
            allowIn: true,
            allowStrictDirective: true,
            allowYield: true,
            firstCoverInitializedNameError: null,
            isAssignmentTarget: false,
            isBindingElement: false,
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            inClassConstructor: false,
            labelSet: {},
            strict: false
        };
        this.tokens = [];

        this.startMarker = {
            index: 0,
            line: this.scanner.lineNumber,
            column: 0
        };
        this.lastMarker = {
            index: 0,
            line: this.scanner.lineNumber,
            column: 0
        };
        this.nextToken();
        this.lastMarker = {
            index: this.scanner.index,
            line: this.scanner.lineNumber,
            column: this.scanner.index - this.scanner.lineStart
        };
    }

    throwError(messageFormat: string, ...values: RawTokenValue[]): void {
        const args = values.slice();
        const msg = messageFormat.replace(/%(\d)/g, (_whole, idx) => {
            assert(idx as number < args.length, 'Message reference must be in range');
            return args[idx as number] as string;
        }
        );

        const index = this.lastMarker.index;
        const line = this.lastMarker.line;
        const column = this.lastMarker.column + 1;
        throw this.errorHandler.createError(index, line, column, msg);
    }

    tolerateError(messageFormat: string, ...values: RawTokenValue[]): void {
        const args = values.slice();
        const msg = messageFormat.replace(/%(\d)/g, (_whole, idx) => {
            assert(idx < args.length, 'Message reference must be in range');
            return args[idx as number] as string;
        }
        );

        const index = this.lastMarker.index;
        const line = this.scanner.lineNumber;
        const column = this.lastMarker.column + 1;
        this.errorHandler.tolerateError(index, line, column, msg);
    }

    // Throw an exception because of the token.
    unexpectedTokenError(token?: RawToken, message?: string): Error {
        let msg = message || Messages.UnexpectedToken;

        if (token) {
            if (!message) {
                msg = (token.type === Token.EOF) ? Messages.UnexpectedEOS :
                    (token.type === Token.Identifier) ? Messages.UnexpectedIdentifier :
                        (token.type === Token.NumericLiteral) ? Messages.UnexpectedNumber :
                            (token.type === Token.StringLiteral) ? Messages.UnexpectedString :
                                (token.type === Token.Template) ? Messages.UnexpectedTemplate :
                                    Messages.UnexpectedToken;

                if (token.type === Token.Keyword) {
                    if (this.scanner.isFutureReservedWord(token.value as string)) {
                        msg = Messages.UnexpectedReserved;
                    }
                    else if (this.context.strict && this.scanner.isStrictModeReservedWord(token.value as string)) {
                        msg = Messages.StrictReservedWord;
                    }
                }
            }

            msg = msg.replace('%0', token.value as string);
        }
        else {
            msg = msg.replace('%0', 'ILLEGAL');
        }


        if (token && typeof token.lineNumber === 'number') {
            const index = token.start;
            const line = token.lineNumber;
            const lastMarkerLineStart = this.lastMarker.index - this.lastMarker.column;
            const column = token.start - lastMarkerLineStart + 1;
            return this.errorHandler.createError(index, line, column, msg);
        }
        else {
            const index = this.lastMarker.index;
            const line = this.lastMarker.line;
            const column = this.lastMarker.column + 1;
            return this.errorHandler.createError(index, line, column, msg);
        }
    }

    throwUnexpectedToken(token?: RawToken, message?: string): never {
        throw this.unexpectedTokenError(token, message);
    }

    tolerateUnexpectedToken(token?: RawToken, message?: string): void {
        this.errorHandler.tolerate(this.unexpectedTokenError(token, message));
    }

    tolerateInvalidLoopStatement(): void {
        if (this.matchKeyword("class") || this.matchKeyword("function")) {
            // DGH: Changed this.lookahead to this.lookahead.value
            this.tolerateError(Messages.UnexpectedToken, this.lookahead as unknown as RawTokenValue);
        }
    }

    collectComments(): void {
        if (!this.config.comment) {
            this.scanner.scanComments();
        }
        else {
            const comments: Comment[] | undefined = this.scanner.scanComments();
            if (Array.isArray(comments) && comments.length > 0 && this.delegate) {
                for (let i = 0; i < comments.length; ++i) {
                    const e: Comment = comments[i];
                    const node = create_comment_node(e.multiLine, this.scanner.source.slice(e.slice[0], e.slice[1]));
                    if (this.config.range) {
                        node.range = e.range;
                    }
                    if (this.config.loc) {
                        node.loc = e.loc;
                    }
                    const metadata = {
                        start: {
                            line: e.loc.start.line,
                            column: e.loc.start.column,
                            offset: e.range[0]
                        },
                        end: {
                            line: e.loc.end.line,
                            column: e.loc.end.column,
                            offset: e.range[1]
                        }
                    };
                    this.delegate(node, metadata);
                }
            }
        }
    }

    // From internal representation to an external structure

    getTokenRaw(token: RawToken): string {
        return this.scanner.source.slice(token.start, token.end);
    }

    convertToken(token: RawToken): TokenEntry {
        const t: TokenEntry = {
            type: TokenName[token.type],
            value: this.getTokenRaw(token)
        };
        if (this.config.range) {
            t.range = [token.start, token.end];
        }
        if (this.config.loc) {
            t.loc = {
                start: {
                    line: this.startMarker.line,
                    column: this.startMarker.column
                },
                end: {
                    line: this.scanner.lineNumber,
                    column: this.scanner.index - this.scanner.lineStart
                }
            };
        }
        if (token.type === Token.RegularExpression) {
            const pattern = token.pattern as string;
            const flags = token.flags as string;
            t.regex = { pattern, flags };
        }

        return t;
    }

    nextToken(): RawToken {
        const token = this.lookahead;

        this.lastMarker.index = this.scanner.index;
        this.lastMarker.line = this.scanner.lineNumber;
        this.lastMarker.column = this.scanner.index - this.scanner.lineStart;

        this.collectComments();

        if (this.scanner.index !== this.startMarker.index) {
            this.startMarker.index = this.scanner.index;
            this.startMarker.line = this.scanner.lineNumber;
            this.startMarker.column = this.scanner.index - this.scanner.lineStart;
        }

        const next = this.scanner.lex();
        this.hasLineTerminator = (token.lineNumber !== next.lineNumber);

        if (next && this.context.strict && next.type === Token.Identifier) {
            if (this.scanner.isStrictModeReservedWord(next.value as string)) {
                next.type = Token.Keyword;
            }
        }
        this.lookahead = next;

        if (this.config.tokens && next.type !== Token.EOF) {
            this.tokens.push(this.convertToken(next));
        }

        return token;
    }

    nextRegexToken(): RawToken {
        this.collectComments();

        const token = this.scanner.scanRegExp();
        if (this.config.tokens) {
            // Pop the previous token, '/' or '/='
            // This is added from the lookahead token.
            this.tokens.pop();

            this.tokens.push(this.convertToken(token));
        }

        // Prime the next lookahead.
        this.lookahead = token;
        this.nextToken();

        return token;
    }

    createNode(): Marker {
        return {
            index: this.startMarker.index,
            line: this.startMarker.line,
            column: this.startMarker.column
        };
    }

    startNode(token: RawToken, lastLineStart = 0): Marker {
        let column = token.start - token.lineStart;
        let line = token.lineNumber;
        if (column < 0) {
            column += lastLineStart;
            line--;
        }
        return {
            index: token.start,
            line: line,
            column: column
        };
    }

    finalize<N extends Node>(marker: Marker, node: N): N {
        if (this.config.range) {
            node.range = [marker.index, this.lastMarker.index];
        }

        if (this.config.loc) {
            node.loc = {
                start: {
                    line: marker.line,
                    column: marker.column,
                },
                end: {
                    line: this.lastMarker.line,
                    column: this.lastMarker.column
                }
            };
            if (this.config.source) {
                node.loc.source = this.config.source;
            }
        }

        if (this.delegate) {
            const metadata = {
                start: {
                    line: marker.line,
                    column: marker.column,
                    offset: marker.index
                },
                end: {
                    line: this.lastMarker.line,
                    column: this.lastMarker.column,
                    offset: this.lastMarker.index
                }
            };
            this.delegate(node, metadata);
        }

        return node;
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    expect(value: string): void {
        const token = this.nextToken();
        if (token.type !== Token.Punctuator || token.value !== value) {
            this.throwUnexpectedToken(token);
        }
    }

    // Quietly expect a comma when in tolerant mode, otherwise delegates to expect().

    expectCommaSeparator(): void {
        if (this.config.tolerant) {
            const token = this.lookahead;
            if (token.type === Token.Punctuator && token.value === ',') {
                this.nextToken();
            }
            else if (token.type === Token.Punctuator && token.value === ';') {
                this.nextToken();
                this.tolerateUnexpectedToken(token);
            }
            else {
                this.tolerateUnexpectedToken(token, Messages.UnexpectedToken);
            }
        }
        else {
            this.expect(',');
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    expectKeyword(keyword: string): void {
        const token = this.nextToken();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            this.throwUnexpectedToken(token);
        }
    }

    /**
     * Return true if the next token is a Punctuator with a matching value.
     */
    match(value: ':' | ';' | '.' | '=' | '<' | '(' | ')' | '{' | '}' | '[' | ']' | ',' | '...' | '*' | '**' | '=>' | '?' | '?.' | '+' | '-' | '++' | '--' | '~' | '!'): boolean {
        return this.lookahead.type === Token.Punctuator && this.lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    matchKeyword(keyword: string): boolean {
        return this.lookahead.type === Token.Keyword && this.lookahead.value === keyword;
    }

    // Return true if the next token matches the specified contextual keyword
    // (where an identifier is sometimes a keyword depending on the context)

    matchContextualKeyword(keyword: 'as' | 'async' | 'await' | 'from' | 'of'): boolean {
        return this.lookahead.type === Token.Identifier && this.lookahead.value === keyword;
    }

    /**
     * @returns true if the next token is some kind of assignment operator.
     */
    matchAssign(): boolean {
        if (this.lookahead.type !== Token.Punctuator) {
            return false;
        }
        const op = this.lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '**=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    // Cover grammar support.
    //
    // When an assignment expression position starts with an left parenthesis, the determination of the type
    // of the syntax is to be deferred arbitrarily long until the end of the parentheses pair (plus a lookahead)
    // or the first comma. This situation also defers the determination of all the expressions nested in the pair.
    //
    // There are three productions that can be parsed in a parentheses pair that needs to be determined
    // after the outermost pair is closed. They are:
    //
    //   1. AssignmentExpression
    //   2. BindingElements
    //   3. AssignmentTargets
    //
    // In order to avoid exponential backtracking, we use two flags to denote if the production can be
    // binding element or assignment target.
    //
    // The three productions have the relationship:
    //
    //   BindingElements ⊆ AssignmentTargets ⊆ AssignmentExpression
    //
    // with a single exception that CoverInitializedName when used directly in an Expression, generates
    // an early error. Therefore, we need the third state, firstCoverInitializedNameError, to track the
    // first usage of CoverInitializedName and report it when we reached the end of the parentheses pair.
    //
    // isolateCoverGrammar function runs the given parser function with a new cover grammar context, and it does not
    // effect the current flags. This means the production the parser parses is only used as an expression. Therefore
    // the CoverInitializedName check is conducted.
    //
    // inheritCoverGrammar function runs the given parse function with a new cover grammar context, and it propagates
    // the flags outside of the parser. This means the production the parser parses is used as a part of a potential
    // pattern. The CoverInitializedName check is deferred.

    isolateCoverGrammar<T>(parseFunction: (this: Parser) => T): T {
        const previousIsBindingElement = this.context.isBindingElement;
        const previousIsAssignmentTarget = this.context.isAssignmentTarget;
        const previousFirstCoverInitializedNameError = this.context.firstCoverInitializedNameError;

        this.context.isBindingElement = true;
        this.context.isAssignmentTarget = true;
        this.context.firstCoverInitializedNameError = null;

        const result = parseFunction.call(this);
        if (this.context.firstCoverInitializedNameError !== null) {
            this.throwUnexpectedToken(this.context.firstCoverInitializedNameError);
        }

        this.context.isBindingElement = previousIsBindingElement;
        this.context.isAssignmentTarget = previousIsAssignmentTarget;
        this.context.firstCoverInitializedNameError = previousFirstCoverInitializedNameError;

        return result;
    }

    inheritCoverGrammar<T>(parseFunction: (this: Parser) => T): T {
        const previousIsBindingElement = this.context.isBindingElement;
        const previousIsAssignmentTarget = this.context.isAssignmentTarget;
        const previousFirstCoverInitializedNameError = this.context.firstCoverInitializedNameError;

        this.context.isBindingElement = true;
        this.context.isAssignmentTarget = true;
        this.context.firstCoverInitializedNameError = null;

        const result = parseFunction.call(this);

        this.context.isBindingElement = this.context.isBindingElement && previousIsBindingElement;
        this.context.isAssignmentTarget = this.context.isAssignmentTarget && previousIsAssignmentTarget;
        this.context.firstCoverInitializedNameError = previousFirstCoverInitializedNameError || this.context.firstCoverInitializedNameError;

        return result;
    }

    consumeSemicolon(): void {
        if (this.match(';')) {
            this.nextToken();
        }
        else {
            if (!this.hasLineTerminator) {
                if (this.lookahead.type !== Token.EOF && !this.match('}')) {
                    this.throwUnexpectedToken(this.lookahead);
                }
                this.lastMarker.index = this.startMarker.index;
                this.lastMarker.line = this.startMarker.line;
                this.lastMarker.column = this.startMarker.column;
            }
        }
    }

    // https://tc39.github.io/ecma262/#sec-primary-expression

    parsePrimaryExpression(): Expression {
        const node = this.createNode();

        let expr: Expression;
        let token: RawToken;
        let raw: string;

        switch (this.lookahead.type) {
            case Token.Identifier:
                if ((this.context.isModule || this.context.isAsync) && this.lookahead.value === 'await') {
                    this.tolerateUnexpectedToken(this.lookahead);
                }
                expr = this.matchAsyncFunction() ? this.parseFunctionExpression() : this.finalize(node, new Identifier(this.nextToken().value as string));
                break;

            case Token.NumericLiteral:
            case Token.StringLiteral:
                if (this.context.strict && this.lookahead.octal) {
                    this.tolerateUnexpectedToken(this.lookahead, Messages.StrictOctalLiteral);
                }
                this.context.isAssignmentTarget = false;
                this.context.isBindingElement = false;
                token = this.nextToken();
                raw = this.getTokenRaw(token);
                expr = this.finalize(node, new Literal(token.value, raw));
                break;

            case Token.BooleanLiteral:
                this.context.isAssignmentTarget = false;
                this.context.isBindingElement = false;
                token = this.nextToken();
                raw = this.getTokenRaw(token);
                expr = this.finalize(node, new Literal(token.value === 'true', raw));
                break;

            case Token.NullLiteral:
                this.context.isAssignmentTarget = false;
                this.context.isBindingElement = false;
                token = this.nextToken();
                raw = this.getTokenRaw(token);
                expr = this.finalize(node, new Literal(null, raw));
                break;

            case Token.Template:
                expr = this.parseTemplateLiteral({ isTagged: false });
                break;

            case Token.Punctuator:
                switch (this.lookahead.value) {
                    case '(':
                        this.context.isBindingElement = false;
                        expr = this.inheritCoverGrammar(this.parseGroupExpression);
                        break;
                    case '[':
                        expr = this.inheritCoverGrammar(this.parseArrayInitializer);
                        break;
                    case '{':
                        expr = this.inheritCoverGrammar(this.parseObjectInitializer);
                        break;
                    case '/':
                    case '/=':
                        this.context.isAssignmentTarget = false;
                        this.context.isBindingElement = false;
                        this.scanner.index = this.startMarker.index;
                        token = this.nextRegexToken();
                        raw = this.getTokenRaw(token);
                        expr = this.finalize(node, new RegexLiteral(token.regex as RegExp, raw, token.pattern!, token.flags));
                        break;
                    default:
                        expr = this.throwUnexpectedToken(this.nextToken());
                }
                break;

            case Token.Keyword:
                if (!this.context.strict && this.context.allowYield && this.matchKeyword('yield')) {
                    expr = this.parseIdentifierName();
                }
                else if (!this.context.strict && this.matchKeyword('let')) {
                    expr = this.finalize(node, new Identifier(this.nextToken().value as string));
                }
                else {
                    this.context.isAssignmentTarget = false;
                    this.context.isBindingElement = false;
                    if (this.matchKeyword('function')) {
                        expr = this.parseFunctionExpression();
                    }
                    else if (this.matchKeyword('this')) {
                        this.nextToken();
                        expr = this.finalize(node, new ThisExpression());
                    }
                    else if (this.matchKeyword('class')) {
                        expr = this.parseClassExpression();
                    }
                    else if (this.matchImportCall()) {
                        expr = this.parseImportCall();
                    }
                    else if (this.matchImportMeta()) {
                        if (!this.context.isModule) {
                            this.tolerateUnexpectedToken(this.lookahead, Messages.CannotUseImportMetaOutsideAModule);
                        }
                        expr = this.parseImportMeta();
                    }
                    else {
                        expr = this.throwUnexpectedToken(this.nextToken());
                    }
                }
                break;

            default:
                expr = this.throwUnexpectedToken(this.nextToken());
        }

        return expr;
    }

    // https://tc39.github.io/ecma262/#sec-array-initializer

    parseSpreadElement(): SpreadElement {
        const node = this.createNode();
        this.expect('...');
        const arg = this.inheritCoverGrammar(this.parseAssignmentExpression);
        return this.finalize(node, new SpreadElement(arg));
    }

    parseArrayInitializer(): ArrayExpression {
        const node = this.createNode();
        const elements: ArrayExpressionElement[] = [];

        this.expect('[');
        while (!this.match(']')) {
            if (this.match(',')) {
                this.nextToken();
                elements.push(null);
            }
            else if (this.match('...')) {
                const element = this.parseSpreadElement();
                if (!this.match(']')) {
                    this.context.isAssignmentTarget = false;
                    this.context.isBindingElement = false;
                    this.expect(',');
                }
                elements.push(element);
            }
            else {
                elements.push(this.inheritCoverGrammar(this.parseAssignmentExpression));
                if (!this.match(']')) {
                    this.expect(',');
                }
            }
        }
        this.expect(']');

        return this.finalize(node, new ArrayExpression(elements));
    }

    // https://tc39.github.io/ecma262/#sec-object-initializer

    parsePropertyMethod(params: FormalParameters): BlockStatement {
        this.context.isAssignmentTarget = false;
        this.context.isBindingElement = false;

        const previousStrict = this.context.strict;
        const previousAllowStrictDirective = this.context.allowStrictDirective;
        this.context.allowStrictDirective = params.simple;
        const body = this.isolateCoverGrammar(this.parseFunctionSourceElements);
        if (this.context.strict && params.firstRestricted) {
            this.tolerateUnexpectedToken(params.firstRestricted, params.message);
        }
        if (this.context.strict && params.stricted) {
            this.tolerateUnexpectedToken(params.stricted, params.message);
        }
        this.context.strict = previousStrict;
        this.context.allowStrictDirective = previousAllowStrictDirective;

        return body;
    }

    parsePropertyMethodFunction(isGenerator: boolean): FunctionExpression {
        const node = this.createNode();

        const previousAllowYield = this.context.allowYield;
        this.context.allowYield = true;
        const params = this.parseFormalParameters();
        const method = this.parsePropertyMethod(params);
        this.context.allowYield = previousAllowYield;

        return this.finalize(node, new FunctionExpression(null, params.params, method, isGenerator, false));
    }

    parsePropertyMethodAsyncFunction(isGenerator: boolean): FunctionExpression {
        const node = this.createNode();

        const previousAllowYield = this.context.allowYield;
        const previousIsAsync = this.context.isAsync;
        this.context.allowYield = false;
        this.context.isAsync = true;

        const params = this.parseFormalParameters();
        const method = this.parsePropertyMethod(params);
        this.context.allowYield = previousAllowYield;
        this.context.isAsync = previousIsAsync;

        return this.finalize(node, new FunctionExpression(null, params.params, method, isGenerator, true));
    }

    parseObjectPropertyKey(): PropertyKey {
        const node = this.createNode();
        const token = this.nextToken();

        let key: PropertyKey;
        switch (token.type) {
            case Token.StringLiteral:
            case Token.NumericLiteral: {
                if (this.context.strict && token.octal) {
                    this.tolerateUnexpectedToken(token, Messages.StrictOctalLiteral);
                }
                const raw = this.getTokenRaw(token);
                key = this.finalize(node, new Literal(token.value as string, raw));
                break;
            }
            case Token.Identifier:
            case Token.BooleanLiteral:
            case Token.NullLiteral:
            case Token.Keyword:
                key = this.finalize(node, new Identifier(as_string(token.value)));
                break;

            case Token.Punctuator:
                if (token.value === '[') {
                    key = this.isolateCoverGrammar(this.parseAssignmentExpression) as PropertyKey;
                    this.expect(']');
                }
                else {
                    key = this.throwUnexpectedToken(token);
                }
                break;

            default:
                key = this.throwUnexpectedToken(token);
        }

        return key;
    }

    isPropertyKey(key: Node | null, value: string): boolean {
        if (key) {
            return (is_identifier(key) && key.name === value) || (is_literal(key) && key.value === value);
        }
        else {
            return false;
        }
    }

    parseObjectProperty(hasProto: { value: boolean }): Property {
        const node = this.createNode();
        const token = this.lookahead;

        let kind: 'get' | 'set' | 'init';
        let key: PropertyKey | null = null;
        let value: PropertyValue | Expression | null = null;

        let computed = false;
        let method = false;
        let shorthand = false;
        let isAsync = false;
        let isGenerator = false;

        if (token.type === Token.Identifier) {
            const id = as_string(token.value);
            this.nextToken();
            computed = this.match('[');
            isAsync = !this.hasLineTerminator && (id === 'async') &&
                !this.match(':') && !this.match('(') && !this.match(',');
            isGenerator = this.match('*');
            if (isGenerator) {
                this.nextToken();
            }
            key = isAsync ? this.parseObjectPropertyKey() : this.finalize(node, new Identifier(id));
        }
        else if (this.match('*')) {
            this.nextToken();
        }
        else {
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
        }

        const lookaheadPropertyKey = this.qualifiedPropertyName(this.lookahead);
        if (token.type === Token.Identifier && !isAsync && token.value === 'get' && lookaheadPropertyKey) {
            kind = 'get';
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            this.context.allowYield = false;
            value = this.parseGetterMethod();

        }
        else if (token.type === Token.Identifier && !isAsync && token.value === 'set' && lookaheadPropertyKey) {
            kind = 'set';
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            value = this.parseSetterMethod();

        }
        else if (token.type === Token.Punctuator && token.value === '*' && lookaheadPropertyKey) {
            kind = 'init';
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            value = this.parseGeneratorMethod();
            method = true;

        }
        else {
            if (!key) {
                this.throwUnexpectedToken(this.lookahead);
            }

            kind = 'init';
            if (this.match(':') && !isAsync) {
                if (!computed && this.isPropertyKey(key, '__proto__')) {
                    if (hasProto.value) {
                        this.tolerateError(Messages.DuplicateProtoProperty);
                    }
                    hasProto.value = true;
                }
                this.nextToken();
                value = this.inheritCoverGrammar(this.parseAssignmentExpression);

            }
            else if (this.match('(')) {
                value = isAsync ? this.parsePropertyMethodAsyncFunction(isGenerator) : this.parsePropertyMethodFunction(isGenerator);
                method = true;

            }
            else if (token.type === Token.Identifier) {
                const id = this.finalize(node, new Identifier(as_string(token.value)));
                if (this.match('=')) {
                    this.context.firstCoverInitializedNameError = this.lookahead;
                    this.nextToken();
                    shorthand = true;
                    const init = this.isolateCoverGrammar(this.parseAssignmentExpression);
                    value = this.finalize(node, new AssignmentPattern(id, init));
                }
                else {
                    shorthand = true;
                    value = id;
                }
            }
            else {
                this.throwUnexpectedToken(this.nextToken());
            }
        }

        return this.finalize(node, new Property(kind, key, computed, value as PropertyValue, method, shorthand));
    }

    parseObjectInitializer(): ObjectExpression {
        const node = this.createNode();

        this.expect('{');
        const properties: ObjectExpressionProperty[] = [];
        const hasProto = { value: false };
        while (!this.match('}')) {
            properties.push(this.match('...') ? this.parseSpreadElement() : this.parseObjectProperty(hasProto));
            if (!this.match('}')) {
                this.expectCommaSeparator();
            }
        }
        this.expect('}');

        return this.finalize(node, new ObjectExpression(properties));
    }

    // https://tc39.es/proposal-template-literal-revision/#sec-static-semantics-template-early-errors
    throwTemplateLiteralEarlyErrors(token: RawToken): never {
        switch (token.notEscapeSequenceHead) {
            case 'u':
                return this.throwUnexpectedToken(token, Messages.InvalidUnicodeEscapeSequence);
            case 'x':
                return this.throwUnexpectedToken(token, Messages.InvalidHexEscapeSequence);
            case '8':
            case '9':
                return this.throwUnexpectedToken(token, Messages.TemplateEscape89);
            default: // For 0-7
                return this.throwUnexpectedToken(token, Messages.TemplateOctalLiteral);
        }
    }
    // https://tc39.github.io/ecma262/#sec-template-literals

    parseTemplateHead(options: ParseTemplateLiteralOptions): TemplateElement {
        assert(this.lookahead.head as boolean, 'Template literal must start with a template head');

        const node = this.createNode();
        const token = this.nextToken();
        if (!options.isTagged && token.notEscapeSequenceHead !== null) {
            this.throwTemplateLiteralEarlyErrors(token);
        }
        const raw = token.value as string;
        const cooked = token.cooked as string;

        return this.finalize(node, new TemplateElement({ raw, cooked }, token.tail as boolean));
    }

    parseTemplateElement(options: ParseTemplateLiteralOptions): TemplateElement {
        if (this.lookahead.type !== Token.Template) {
            this.throwUnexpectedToken();
        }

        const node = this.createNode();
        const token = this.nextToken();
        if (!options.isTagged && token.notEscapeSequenceHead !== null) {
            this.throwTemplateLiteralEarlyErrors(token);
        }
        const raw = token.value as string;
        const cooked = token.cooked as string;

        return this.finalize(node, new TemplateElement({ raw, cooked }, token.tail as boolean));
    }

    parseTemplateLiteral(options: ParseTemplateLiteralOptions): TemplateLiteral {
        const node = this.createNode();

        const expressions: Expression[] = [];
        const quasis: TemplateElement[] = [];

        let quasi = this.parseTemplateHead(options);
        quasis.push(quasi);
        while (!quasi.tail) {
            expressions.push(this.parseExpression());
            quasi = this.parseTemplateElement(options);
            quasis.push(quasi);
        }

        return this.finalize(node, new TemplateLiteral(quasis, expressions));
    }

    // https://tc39.github.io/ecma262/#sec-grouping-operator
    /**
     * Dubious original esprima code re-implemented with type guards but otherwise the same.
     */
    reinterpretExpressionAsPattern(expr: Expression): void {
        if (is_identifier(expr) || is_member_expression(expr) || is_rest_element(expr) || is_assignment_pattern(expr)) {
            // Do nothing.
        }
        else if (is_spread_element(expr)) {
            (expr as unknown as MutableNode).type = Syntax.RestElement;
            this.reinterpretExpressionAsPattern(expr.argument);
            return;
        }
        else if (is_array_expression(expr)) {
            (expr as unknown as MutableNode).type = Syntax.ArrayPattern;
            for (let i = 0; i < expr.elements.length; i++) {
                if (expr.elements[i] !== null) {
                    this.reinterpretExpressionAsPattern(expr.elements[i]!);
                }
            }
        }
        else if (is_object_expression(expr)) {
            (expr as unknown as MutableNode).type = Syntax.ObjectPattern;
            for (let i = 0; i < expr.properties.length; i++) {
                const property = expr.properties[i];
                this.reinterpretExpressionAsPattern(is_spread_element(property) ? property as Expression : property.value as Expression);
            }
        }
        else if (is_assignment_expression(expr)) {
            (expr as unknown as MutableNode).type = Syntax.AssignmentPattern;
            delete (expr as unknown as MutableNode).operator;
            this.reinterpretExpressionAsPattern(expr.left);
        }
        else {
            // Allow other node type for tolerant parsing.
        }
    }

    /*
    reintepretSpreadElementAsRestElement(node: SpreadElement): RestElement {
        const pattern = this.reinterpretExpressionAsPattern(node.argument);
        if (is_array_pattern(pattern)) {
            return new RestElement(pattern);
        }
        else if (is_assignment_pattern(pattern)) {
            throw new Error(`reintepretSpreadElementAsRestElement A`);
        }
        else if (is_identifier(pattern)) {
            return new RestElement(pattern);
        }
        else if (is_member_expression(pattern)) {
            return new RestElement(pattern);
        }
        else if (is_object_pattern(pattern)) {
            return new RestElement(pattern);
        }
        else if (is_rest_element(pattern)) {
            throw new Error(`reintepretSpreadElementAsRestElement C`);
        }
        else {
            throw new Error(`reintepretSpreadElementAsRestElement E`);
        }
    }

    reinterpretArrayExpressionElementAsArrayPatternElement(expr: ArrayExpressionElement): ArrayPatternElement | ComputedMemberExpression | StaticMemberExpression {
        if (expr) {
            if (is_spread_element(expr)) {
                return this.reintepretSpreadElementAsRestElement(expr);
            }
            else if (is_identifier(expr)) {
                return expr;
            }
            else if (is_array_expression(expr)) {
                return this.reinterpretArrayExpressionAsArrayPattern(expr);
            }
            else if (is_member_expression(expr)) {
                return expr;
            }
            else if (is_object_expression(expr)) {
                return this.reinterpretObjectExpressionAsObjectPattern(expr);
            }
            else if (is_assignment_expression(expr)) {
                const pattern = this.reinterpretExpressionAsPattern(expr.left);
                if (is_identifier(pattern)) {
                    return pattern;
                }
                else if (is_array_pattern(pattern)) {
                    return pattern;
                }
                throw new Error(`pattern ??? ${pattern.type}`);
            }
            // TODO: AssignmentPattern may all be created.
            throw new Error(`expr ??? ${expr.type}`);
        }
        else {
            return null;
        }
    }

    reinterpretArrayExpressionAsArrayPattern(expr: ArrayExpression): ArrayPattern {
        const elements: (ArrayPatternElement | ComputedMemberExpression | StaticMemberExpression)[] = expr.elements.map(e => this.reinterpretArrayExpressionElementAsArrayPatternElement(e));
        return new ArrayPattern(elements as ArrayPatternElement[]);
    }

    reintepretPropertyAsRestProperty(node: Property): RestElement {
        if (node.value) {
            const argument = this.reinterpretExpressionAsPattern(node.value);
            return new RestElement(assert_rest_element_argument(argument));
        }
        else {
            throw new Error(`reinterpretPropertyAsRestProperty ${node.value}`);
            // return new RestElement(null);
        }
    }

    reinterpretObjectExpressionAsObjectPattern(expr: ObjectExpression): ObjectPattern {
        const properties = expr.properties.map(p => this.reintepretAsRestProperty(p));
        return new ObjectPattern(properties);
    }

    reintepretAsRestProperty(node: ObjectExpressionProperty): RestElement {
        if (is_property(node)) {
            return this.reintepretPropertyAsRestProperty(node);
        }
        else if (is_spread_element(node)) {
            return this.reintepretSpreadElementAsRestElement(node);
        }
        else {
            throw new Error(`reinterpretAsRestProperty ${JSON.stringify(node)}`);
        }
    }

    reinterpretExpressionAsPattern(expr: Expression): ArrayPattern | AssignmentPattern | ComputedMemberExpression | Expression | Identifier | Literal | ObjectPattern | RestElement | StaticMemberExpression {
        if (is_array_expression(expr)) {
            return this.reinterpretArrayExpressionAsArrayPattern(expr);
        }
        else if (is_assignment_expression(expr)) {
            return this.reinterpretExpressionAsPattern(expr.left);
        }
        else if (is_object_expression(expr)) {
            return this.reinterpretObjectExpressionAsObjectPattern(expr);
        }
        else if (is_spread_element(expr)) {
            return this.reintepretSpreadElementAsRestElement(expr);
        }
        else if (is_identifier(expr)) {
            return expr;
        }
        else if (is_literal(expr)) {
            // Allowing for tolerant parsing or is this acceptable?
            return expr;
        }
        else if (is_member_expression(expr)) {
            return expr;
        }
        else if (is_rest_element(expr)) {
            return expr;
        }
        else if (is_assignment_pattern(expr)) {
            return expr;
        }
        else {
            // Allowing other node types for tolerant parsing, even though it messes with the type system.
            return expr;
        }
    }
    */

    parseGroupExpression(): ArrowParameterPlaceHolder | Expression {

        this.expect('(');
        if (this.match(')')) {
            this.nextToken();
            if (!this.match('=>')) {
                this.expect('=>');
            }
            return new ArrowParameterPlaceHolder([], false);
        }
        else {
            const startToken = this.lookahead;
            const params: RawToken[] = [];
            if (this.match('...')) {
                const restElement = this.parseRestElement(params);
                this.expect(')');
                if (!this.match('=>')) {
                    this.expect('=>');
                }
                return new ArrowParameterPlaceHolder([restElement], false);
            }
            else {
                let arrow = false;
                this.context.isBindingElement = true;
                let expr = this.inheritCoverGrammar(this.parseAssignmentExpression);

                if (this.match(',')) {
                    const expressions: Expression[] = [];

                    this.context.isAssignmentTarget = false;
                    expressions.push(expr);
                    while (this.lookahead.type !== Token.EOF) {
                        if (!this.match(',')) {
                            break;
                        }
                        this.nextToken();
                        if (this.match(')')) {
                            this.nextToken();
                            for (let i = 0; i < expressions.length; i++) {
                                this.reinterpretExpressionAsPattern(expressions[i]);
                            }
                            arrow = true;
                            expr = new ArrowParameterPlaceHolder(expressions, false);
                        }
                        else if (this.match('...')) {
                            if (!this.context.isBindingElement) {
                                this.throwUnexpectedToken(this.lookahead);
                            }
                            expressions.push(this.parseRestElement(params));
                            this.expect(')');
                            if (!this.match('=>')) {
                                this.expect('=>');
                            }
                            this.context.isBindingElement = false;
                            for (let i = 0; i < expressions.length; i++) {
                                this.reinterpretExpressionAsPattern(expressions[i]);
                            }
                            arrow = true;
                            expr = new ArrowParameterPlaceHolder(expressions, false);
                        }
                        else {
                            expressions.push(this.inheritCoverGrammar(this.parseAssignmentExpression));
                        }
                        if (arrow) {
                            break;
                        }
                    }
                    if (!arrow) {
                        expr = this.finalize(this.startNode(startToken), new SequenceExpression(expressions));
                    }
                }

                if (!arrow) {
                    this.expect(')');
                    if (this.match('=>')) {
                        if (is_identifier(expr) && expr.name === 'yield') {
                            arrow = true;
                            expr = new ArrowParameterPlaceHolder([expr], false);
                        }
                        if (!arrow) {
                            if (!this.context.isBindingElement) {
                                this.throwUnexpectedToken(this.lookahead);
                            }

                            if (is_sequence_expression(expr)) {
                                for (let i = 0; i < expr.expressions.length; i++) {
                                    this.reinterpretExpressionAsPattern(expr.expressions[i]);
                                }
                            }
                            else {
                                this.reinterpretExpressionAsPattern(expr);
                            }

                            const parameters = (is_sequence_expression(expr) ? expr.expressions : [expr]);
                            expr = new ArrowParameterPlaceHolder(parameters, false);
                        }
                    }
                    this.context.isBindingElement = false;
                }
                return expr;
            }
        }
    }

    // https://tc39.github.io/ecma262/#sec-left-hand-side-expressions

    parseArguments(): ArgumentListElement[] {
        this.expect('(');
        const args: ArgumentListElement[] = [];
        if (!this.match(')')) {
            while (true) {
                const expr = this.match('...') ? this.parseSpreadElement() :
                    this.isolateCoverGrammar(this.parseAssignmentExpression);
                args.push(expr);
                if (this.match(')')) {
                    break;
                }
                this.expectCommaSeparator();
                if (this.match(')')) {
                    break;
                }
            }
        }
        this.expect(')');

        return args;
    }

    isIdentifierName(token: RawToken): boolean {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    parseIdentifierName(): Identifier {
        const node = this.createNode();
        const token = this.nextToken();
        if (!this.isIdentifierName(token)) {
            this.throwUnexpectedToken(token);
        }
        return this.finalize(node, new Identifier(as_string(token.value)));
    }

    parseNewExpression(): MetaProperty | NewExpression {
        const node = this.createNode();

        const id = this.parseIdentifierName();
        assert(id.name === 'new', 'New expression must start with `new`');

        if (this.match('.')) {
            this.nextToken();
            if (this.lookahead.type === Token.Identifier && this.context.inFunctionBody && this.lookahead.value === 'target') {
                const property = this.parseIdentifierName();
                const expr = new MetaProperty(id, property);
                return this.finalize(node, expr);
            }
            else {
                this.throwUnexpectedToken(this.lookahead);
            }
        }
        else if (this.matchKeyword('import')) {
            this.throwUnexpectedToken(this.lookahead);
        }
        else {
            const callee = this.isolateCoverGrammar(this.parseLeftHandSideExpression);
            const args = this.match('(') ? this.parseArguments() : [];
            const expr = new NewExpression(callee, args);
            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;
            return this.finalize(node, expr);
        }
    }

    parseAsyncArgument(): Expression {
        const arg = this.parseAssignmentExpression();
        this.context.firstCoverInitializedNameError = null;
        return arg;
    }

    parseAsyncArguments(): ArgumentListElement[] {
        this.expect('(');
        const args: ArgumentListElement[] = [];
        if (!this.match(')')) {
            while (true) {
                const expr = this.match('...') ? this.parseSpreadElement() :
                    this.isolateCoverGrammar(this.parseAsyncArgument);
                args.push(expr);
                if (this.match(')')) {
                    break;
                }
                this.expectCommaSeparator();
                if (this.match(')')) {
                    break;
                }
            }
        }
        this.expect(')');

        return args;
    }

    matchImportCall(): boolean {
        let match = this.matchKeyword('import');
        if (match) {
            const state = this.scanner.saveState();
            this.scanner.scanComments();
            const next = this.scanner.lex();
            this.scanner.restoreState(state);
            match = (next.type === Token.Punctuator) && (next.value === '(');
        }

        return match;
    }

    parseImportCall(): Import {
        const node = this.createNode();
        this.expectKeyword('import');
        return this.finalize(node, new Import());
    }

    matchImportMeta(): boolean {
        let match = this.matchKeyword('import');
        if (match) {
            const state = this.scanner.saveState();
            this.scanner.scanComments();
            const dot = this.scanner.lex();
            if ((dot.type === Token.Punctuator) && (dot.value === '.')) {
                this.scanner.scanComments();
                const meta = this.scanner.lex();
                match = (meta.type === Token.Identifier) && (meta.value === 'meta');
                if (match) {
                    if (meta.end - meta.start !== 'meta'.length) {
                        this.tolerateUnexpectedToken(meta, Messages.InvalidEscapedReservedWord);
                    }
                }
            }
            else {
                match = false;
            }
            this.scanner.restoreState(state);
        }

        return match;
    }

    parseImportMeta(): MetaProperty {
        const node = this.createNode();
        const id = this.parseIdentifierName(); // 'import', already ensured by matchImportMeta
        this.expect('.');
        const property = this.parseIdentifierName(); // 'meta', already ensured by matchImportMeta
        this.context.isAssignmentTarget = false;
        return this.finalize(node, new MetaProperty(id, property));
    }

    parseLeftHandSideExpressionAllowCall(): Expression {
        const startToken = this.lookahead;
        const maybeAsync = this.matchContextualKeyword('async');

        const previousAllowIn = this.context.allowIn;
        this.context.allowIn = true;

        let expr: Expression;
        const isSuper = this.matchKeyword('super');
        if (isSuper && this.context.inFunctionBody) {
            const marker = this.createNode();
            this.nextToken();
            expr = this.finalize(marker, new Super());
            if (!this.match('(') && !this.match('.') && !this.match('[')) {
                this.throwUnexpectedToken(this.lookahead);
            }
        }
        else {
            expr = this.parseNewOrPrimaryExpression();
        }

        if (isSuper && this.match('(') && !this.context.inClassConstructor) {
            this.tolerateError(Messages.UnexpectedSuper);
        }

        let hasOptional = false;
        while (true) {
            let optional = false;
            if (this.match('?.')) {
                optional = true;
                hasOptional = true;
                this.expect('?.');
            }

            if (this.match('(')) {
                const asyncArrow = maybeAsync && (startToken.lineNumber === this.lookahead.lineNumber);
                this.context.isBindingElement = false;
                this.context.isAssignmentTarget = false;
                const args = asyncArrow ? this.parseAsyncArguments() : this.parseArguments();
                if (expr.type === Syntax.Import && args.length !== 1) {
                    this.tolerateError(Messages.BadImportCallArity);
                }
                expr = this.finalize(this.startNode(startToken), new CallExpression(expr, args, optional));
                if (asyncArrow && this.match('=>')) {
                    for (let i = 0; i < args.length; ++i) {
                        this.reinterpretExpressionAsPattern(args[i]);
                    }
                    expr = new ArrowParameterPlaceHolder(args, true);
                }
            }
            else if (this.match('[')) {
                this.context.isBindingElement = false;
                this.context.isAssignmentTarget = !optional;
                this.expect('[');
                const property = this.isolateCoverGrammar(this.parseExpression);
                this.expect(']');
                expr = this.finalize(this.startNode(startToken), new MemberExpression(expr, property, optional, true));

            }
            else if (this.lookahead.type === Token.Template && this.lookahead.head) {
                // Optional template literal is not included in the spec.
                // https://github.com/tc39/proposal-optional-chaining/issues/54
                if (optional) {
                    this.throwUnexpectedToken(this.lookahead);
                }
                if (hasOptional) {
                    this.throwError(Messages.InvalidTaggedTemplateOnOptionalChain);
                }
                const quasi = this.parseTemplateLiteral({ isTagged: true });
                expr = this.finalize(this.startNode(startToken), new TaggedTemplateExpression(expr, quasi));

            }
            else if (this.match('.') || optional) {
                this.context.isBindingElement = false;
                this.context.isAssignmentTarget = !optional;
                if (!optional) {
                    this.expect('.');
                }
                const property = this.parseIdentifierName();
                expr = this.finalize(this.startNode(startToken), new MemberExpression(expr, property, optional, false));

            }
            else {
                break;
            }
        }
        this.context.allowIn = previousAllowIn;
        if (hasOptional) {
            return new ChainExpression(expr as ChainElement);
        }

        return expr;
    }

    parseSuper(): Super {
        const node = this.createNode();

        this.expectKeyword('super');
        if (!this.match('[') && !this.match('.')) {
            this.throwUnexpectedToken(this.lookahead);
        }

        return this.finalize(node, new Super());
    }

    parseNewOrPrimaryExpression(): NewExpression | MetaProperty | Expression {
        if (this.matchKeyword('new')) {
            return this.inheritCoverGrammar(this.parseNewExpression);
        }
        else {
            return this.inheritCoverGrammar(this.parsePrimaryExpression);
        }
    }

    parseSuperOrNewOrPrimaryExpression(): Super | NewExpression | MetaProperty | Expression {
        if (this.matchKeyword('super') && this.context.inFunctionBody) {
            return this.parseSuper();
        }
        else {
            return this.parseNewOrPrimaryExpression();
        }
    }

    parseLeftHandSideExpression(): Expression {
        assert(this.context.allowIn, 'callee of new expression always allow in keyword.');

        const node = this.startNode(this.lookahead);

        let expr = this.parseSuperOrNewOrPrimaryExpression();

        let hasOptional = false;
        while (true) {
            let optional = false;
            if (this.match('?.')) {
                optional = true;
                hasOptional = true;
                this.expect('?.');
            }
            if (this.match('[')) {
                this.context.isBindingElement = false;
                this.context.isAssignmentTarget = !optional;
                this.expect('[');
                const property = this.isolateCoverGrammar(this.parseExpression);
                this.expect(']');
                expr = this.finalize(node, new MemberExpression(expr, property, optional, true));

            }
            else if (this.lookahead.type === Token.Template && this.lookahead.head) {
                // Optional template literal is not included in the spec.
                // https://github.com/tc39/proposal-optional-chaining/issues/54
                if (optional) {
                    this.throwUnexpectedToken(this.lookahead);
                }
                if (hasOptional) {
                    this.throwError(Messages.InvalidTaggedTemplateOnOptionalChain);
                }
                const quasi = this.parseTemplateLiteral({ isTagged: true });
                expr = this.finalize(node, new TaggedTemplateExpression(expr, quasi));

            }
            else if (this.match('.') || optional) {
                this.context.isBindingElement = false;
                this.context.isAssignmentTarget = !optional;
                if (!optional) {
                    this.expect('.');
                }
                const property = this.parseIdentifierName();
                expr = this.finalize(node, new MemberExpression(expr, property, optional, false));

            }
            else {
                break;
            }
        }
        if (hasOptional) {
            return new ChainExpression(expr as ChainElement);
        }

        return expr;
    }

    // https://tc39.github.io/ecma262/#sec-update-expressions

    parseUpdateExpression(): Expression {
        const startToken = this.lookahead;

        if (this.match('++') || this.match('--')) {
            const marker = this.startNode(startToken);
            const token = this.nextToken();
            const temp = this.inheritCoverGrammar(this.parseUnaryExpression);
            if (this.context.strict && is_identifier(temp) && this.scanner.isRestrictedWord(temp.name)) {
                this.tolerateError(Messages.StrictLHSPrefix);
            }
            if (!this.context.isAssignmentTarget) {
                this.tolerateError(Messages.InvalidLHSInAssignment);
            }
            const prefix = true;
            const expr = this.finalize(marker, new UpdateExpression(as_string(token.value), temp, prefix));
            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;
            return expr;
        }
        else {
            const expr = this.inheritCoverGrammar(this.parseLeftHandSideExpressionAllowCall);
            if (!this.hasLineTerminator && this.lookahead.type === Token.Punctuator) {
                if (this.match('++') || this.match('--')) {
                    if (this.context.strict && is_identifier(expr) && this.scanner.isRestrictedWord(expr.name)) {
                        this.tolerateError(Messages.StrictLHSPostfix);
                    }
                    if (!this.context.isAssignmentTarget) {
                        this.tolerateError(Messages.InvalidLHSInAssignment);
                    }
                    this.context.isAssignmentTarget = false;
                    this.context.isBindingElement = false;
                    const operator = this.nextToken().value;
                    const prefix = false;
                    return this.finalize(this.startNode(startToken), new UpdateExpression(as_string(operator), expr, prefix));
                }
            }
            return expr;
        }
    }

    // https://tc39.github.io/ecma262/#sec-unary-operators

    parseAwaitExpression(): AwaitExpression {
        const node = this.createNode();
        this.nextToken();
        const argument = this.parseUnaryExpression();
        return this.finalize(node, new AwaitExpression(argument));
    }

    matchUnaryOp(): boolean {
        return this.match('+') || this.match('-') || this.match('~') || this.match('!') || this.matchKeyword('delete') || this.matchKeyword('void') || this.matchKeyword('typeof')
    }

    parseUnaryExpression(): Expression {

        if (this.matchUnaryOp()) {
            const node = this.startNode(this.lookahead);
            const token = this.nextToken();
            const argument = this.inheritCoverGrammar(this.parseUnaryExpression);
            const expr = this.finalize(node, new UnaryExpression(as_unary_operator(token.value), argument));
            if (this.context.strict && expr.operator === 'delete' && is_identifier(expr.argument)) {
                this.tolerateError(Messages.StrictDelete);
            }
            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;
            return expr;
        }
        else if (this.context.isAsync && this.matchContextualKeyword('await')) {
            return this.parseAwaitExpression();
        }
        else {
            return this.parseUpdateExpression();
        }
    }

    parseExponentiationExpression(): Expression {
        const startToken = this.lookahead;
        const expr = this.inheritCoverGrammar(this.parseUnaryExpression);
        if (!is_unary_expression(expr) && this.match('**')) {
            this.nextToken();
            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;
            const left = expr;
            const right = this.isolateCoverGrammar(this.parseExponentiationExpression);
            return this.finalize(this.startNode(startToken), new BinaryExpression(as_binary_operator('**'), left, right));
        }
        else {
            return expr;
        }
    }

    // https://tc39.github.io/ecma262/#sec-exp-operator
    // https://tc39.github.io/ecma262/#sec-multiplicative-operators
    // https://tc39.github.io/ecma262/#sec-additive-operators
    // https://tc39.github.io/ecma262/#sec-bitwise-shift-operators
    // https://tc39.github.io/ecma262/#sec-relational-operators
    // https://tc39.github.io/ecma262/#sec-equality-operators
    // https://tc39.github.io/ecma262/#sec-binary-bitwise-operators
    // https://tc39.github.io/ecma262/#sec-binary-logical-operators

    binaryPrecedence(token: RawToken): number {
        const op = token.value;
        if (token.type === Token.Punctuator) {
            return this.operatorPrecedence[op as ')'] || 0;
        }
        else if (token.type === Token.Keyword) {
            return (op === 'instanceof' || (this.context.allowIn && op === 'in')) ? 12 : 0;
        }
        else {
            return 0;
        }
    }

    parseBinaryExpression(): Expression {
        const startToken = this.lookahead;

        let expr = this.inheritCoverGrammar(this.parseExponentiationExpression);

        let allowAndOr = true;
        let allowNullishCoalescing = true;
        const updateNullishCoalescingRestrictions = (token: RawToken): void => {
            if (token.value === '&&' || token.value === '||') {
                allowNullishCoalescing = false;
            }
            if (token.value === '??') {
                allowAndOr = false;
            }
        };

        const token = this.lookahead;
        let prec = this.binaryPrecedence(token);
        if (prec > 0) {
            updateNullishCoalescingRestrictions(token);
            this.nextToken();

            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;

            const markers = [startToken, this.lookahead];
            let left = expr;
            let right = this.isolateCoverGrammar(this.parseExponentiationExpression);

            const stack = [left, token.value, right];
            const precedences: number[] = [prec];
            while (true) {
                prec = this.binaryPrecedence(this.lookahead);
                if (prec <= 0) {
                    break;
                }
                if ((!allowAndOr && (this.lookahead.value === '&&' || this.lookahead.value === '||')) ||
                    (!allowNullishCoalescing && this.lookahead.value === '??')) {
                    this.throwUnexpectedToken(this.lookahead);
                }
                updateNullishCoalescingRestrictions(this.lookahead);

                // Reduce: make a binary expression from the three topmost entries.
                while ((stack.length > 2) && (prec <= precedences[precedences.length - 1])) {
                    right = stack.pop() as Expression;
                    const operator = as_binary_operator(assert_raw_token_value(stack.pop()));
                    precedences.pop();
                    left = stack.pop() as Expression;
                    markers.pop();
                    const marker = markers[markers.length - 1];
                    const node = this.startNode(marker, marker.lineStart);
                    stack.push(this.finalize(node, new BinaryExpression(operator, left, right)));
                }

                // Shift.
                stack.push(this.nextToken().value);
                precedences.push(prec);
                markers.push(this.lookahead);
                stack.push(this.isolateCoverGrammar(this.parseExponentiationExpression));
            }

            // Final reduce to clean-up the stack.
            let i = stack.length - 1;
            expr = stack[i] as Expression;

            let lastMarker = markers.pop();
            while (i > 1) {
                const marker = markers.pop();
                const lastLineStart = lastMarker && lastMarker.lineStart;
                const node = this.startNode(marker!, lastLineStart);
                const operator = assert_raw_token_value(stack[i - 1]);
                expr = this.finalize(node, new BinaryExpression(as_binary_operator(operator), stack[i - 2] as Expression, expr));
                i -= 2;
                lastMarker = marker;
            }
        }

        return expr;
    }

    // https://tc39.github.io/ecma262/#sec-conditional-operator

    parseConditionalExpression(): Expression {
        const startToken = this.lookahead;

        const binExpr = this.inheritCoverGrammar(this.parseBinaryExpression);
        if (this.match('?')) {
            this.nextToken();

            const previousAllowIn = this.context.allowIn;
            this.context.allowIn = true;
            const consequent = this.isolateCoverGrammar(this.parseAssignmentExpression);
            this.context.allowIn = previousAllowIn;

            this.expect(':');
            const alternate = this.isolateCoverGrammar(this.parseAssignmentExpression);

            const expr = this.finalize(this.startNode(startToken), new ConditionalExpression(binExpr, consequent, alternate));
            this.context.isAssignmentTarget = false;
            this.context.isBindingElement = false;
            return expr;
        }
        else {
            return binExpr;
        }
    }

    // https://tc39.github.io/ecma262/#sec-assignment-operators

    /**
     * The side-effect of calling this method is to modify options.simple.
     */
    checkPatternParam(options: FormalParameters, param: ArrayPatternElement | Param | Identifier | Expression): void {
        if (param) {
            if (is_identifier(param)) {
                // FIXME?
                this.validateParam(options, param as unknown as RawToken, param.name);
            }
            else if (is_rest_element(param)) {
                this.checkPatternParam(options, param.argument);
            }
            else if (is_assignment_pattern(param)) {
                this.checkPatternParam(options, param.left);
            }
            else if (is_array_pattern(param)) {
                for (let i = 0; i < param.elements.length; i++) {
                    if (param.elements[i] !== null) {
                        this.checkPatternParam(options, param.elements[i]);
                    }
                }
            }
            else if (is_object_pattern(param)) {
                for (let i = 0; i < param.properties.length; i++) {
                    const property = param.properties[i];
                    if (is_rest_element(property)) {
                        this.checkPatternParam(options, property);
                    }
                    else {
                        this.checkPatternParam(options, property.value);
                    }
                }
            }
            options.simple = options.simple && is_identifier(param);
        }
        else {
            options.simple = false;
        }
    }

    reinterpretAsCoverParams(expr: Expression): [params: Expression[], asyncArrow: boolean] {
        if (is_identifier(expr)) {
            return [[expr], false];
        }
        else if (is_arrow_parameter_placeholder(expr)) {
            return [expr.params, expr.async];
        }
        else {
            throw new Error(`reinterpretAsCoverParams`);
        }
    }

    reinterpretAsCoverFormalsList(expr: Expression): FormalParameters | null {

        if (is_identifier(expr)) {
            // Fall through
        }
        else if (is_arrow_parameter_placeholder(expr)) {
            // Fall through
        }
        else {
            return null;
        }

        const [params, asyncArrow] = this.reinterpretAsCoverParams(expr);

        const options: FormalParameters = {
            simple: true,
            params: [],
            paramSet: {}
        };

        for (let i = 0; i < params.length; ++i) {
            const param = params[i];
            if (is_assignment_pattern(param)) {
                if (is_yield_expression(param.right)) {
                    if (param.right.argument) {
                        this.throwUnexpectedToken(this.lookahead);
                    }
                    const paramRight = (param.right as unknown as MutableNode);
                    paramRight.type = Syntax.Identifier;
                    paramRight.name = 'yield';
                    delete paramRight.argument;
                    delete paramRight.delegate;
                }
            }
            else if (asyncArrow && is_identifier(param) && param.name === 'await') {
                this.throwUnexpectedToken(this.lookahead);
            }
            this.checkPatternParam(options, param);
            params[i] = param;
        }

        if (this.context.strict || !this.context.allowYield) {
            for (let i = 0; i < params.length; ++i) {
                const param = params[i];
                if (is_yield_expression(param)) {
                    this.throwUnexpectedToken(this.lookahead);
                }
            }
        }

        if (options.hasDuplicateParameterNames) {
            const token = this.context.strict ? options.stricted : options.firstRestricted;
            this.throwUnexpectedToken(token, Messages.DuplicateParameter);
        }

        return {
            simple: options.simple,
            params: assert_function_parameters(params),
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
        };
    }

    parseAssignmentExpression(): Expression {
        if (!this.context.allowYield && this.matchKeyword('yield')) {
            return this.parseYieldExpression();
        }
        else {
            const startToken = this.lookahead;
            let token = startToken;
            let expr = this.parseConditionalExpression();

            if (token.type === Token.Identifier && (token.lineNumber === this.lookahead.lineNumber) && token.value === 'async') {
                if (this.lookahead.type === Token.Identifier || this.matchKeyword('yield')) {
                    const arg = this.parsePrimaryExpression();
                    this.reinterpretExpressionAsPattern(arg);
                    expr = new ArrowParameterPlaceHolder([arg], true);
                }
            }

            if (is_arrow_parameter_placeholder(expr) || this.match('=>')) {

                // https://tc39.github.io/ecma262/#sec-arrow-function-definitions
                this.context.isAssignmentTarget = false;
                this.context.isBindingElement = false;
                const isAsync = is_arrow_parameter_placeholder(expr) ? expr.async : false;
                const list = this.reinterpretAsCoverFormalsList(expr);

                if (list) {
                    if (this.hasLineTerminator) {
                        this.tolerateUnexpectedToken(this.lookahead);
                    }
                    this.context.firstCoverInitializedNameError = null;

                    const previousStrict = this.context.strict;
                    const previousAllowStrictDirective = this.context.allowStrictDirective;
                    this.context.allowStrictDirective = list.simple;

                    const previousAllowYield = this.context.allowYield;
                    const previousIsAsync = this.context.isAsync;
                    this.context.allowYield = true;
                    this.context.isAsync = isAsync;

                    const node = this.startNode(startToken);
                    this.expect('=>');
                    let body: BlockStatement | Expression;
                    if (this.match('{')) {
                        const previousAllowIn = this.context.allowIn;
                        this.context.allowIn = true;
                        body = this.parseFunctionSourceElements();
                        this.context.allowIn = previousAllowIn;
                    }
                    else {
                        body = this.isolateCoverGrammar(this.parseAssignmentExpression);
                    }
                    const expression = body.type !== Syntax.BlockStatement;

                    if (this.context.strict && list.firstRestricted) {
                        this.throwUnexpectedToken(list.firstRestricted, list.message);
                    }
                    if (this.context.strict && list.stricted) {
                        this.tolerateUnexpectedToken(list.stricted, list.message);
                    }
                    expr = isAsync ? this.finalize(node, new AsyncArrowFunctionExpression(list.params, body, expression)) : this.finalize(node, new ArrowFunctionExpression(list.params, body, expression));

                    this.context.strict = previousStrict;
                    this.context.allowStrictDirective = previousAllowStrictDirective;
                    this.context.allowYield = previousAllowYield;
                    this.context.isAsync = previousIsAsync;
                }
            }
            else {
                if (this.matchAssign()) {
                    if (!this.context.isAssignmentTarget) {
                        this.tolerateError(Messages.InvalidLHSInAssignment);
                    }

                    if (this.context.strict && expr.type === Syntax.Identifier) {
                        const id = expr as Identifier;
                        if (this.scanner.isRestrictedWord(id.name)) {
                            this.tolerateUnexpectedToken(token, Messages.StrictLHSAssignment);
                        }
                        if (this.scanner.isStrictModeReservedWord(id.name)) {
                            this.tolerateUnexpectedToken(token, Messages.StrictReservedWord);
                        }
                    }

                    if (!this.match('=')) {
                        this.context.isAssignmentTarget = false;
                        this.context.isBindingElement = false;
                    }
                    else {
                        this.reinterpretExpressionAsPattern(expr);
                    }

                    token = this.nextToken();
                    const operator = token.value as string;
                    const right = this.isolateCoverGrammar(this.parseAssignmentExpression);
                    expr = this.finalize(this.startNode(startToken), new AssignmentExpression(operator, expr, right));
                    this.context.firstCoverInitializedNameError = null;
                }
            }
            return expr;
        }
    }

    // https://tc39.github.io/ecma262/#sec-comma-operator

    parseExpression(): Expression | SequenceExpression {
        const startToken = this.lookahead;
        const expr = this.isolateCoverGrammar(this.parseAssignmentExpression);
        if (this.match(',')) {
            const expressions: Expression[] = [];
            expressions.push(expr);
            while (this.lookahead.type !== Token.EOF) {
                if (!this.match(',')) {
                    break;
                }
                this.nextToken();
                expressions.push(this.isolateCoverGrammar(this.parseAssignmentExpression));
            }

            return this.finalize(this.startNode(startToken), new SequenceExpression(expressions));
        }
        else {
            return expr;
        }
    }

    // https://tc39.github.io/ecma262/#sec-block

    parseStatementListItem(): StatementListItem {
        this.context.isAssignmentTarget = true;
        this.context.isBindingElement = true;
        if (this.lookahead.type === Token.Keyword) {
            switch (this.lookahead.value) {
                case 'export': {
                    if (!this.context.isModule) {
                        this.tolerateUnexpectedToken(this.lookahead, Messages.IllegalExportDeclaration);
                    }
                    return this.parseExportDeclaration();
                }
                case 'import': {
                    if (this.matchImportCall()) {
                        return this.parseExpressionStatement();
                    }
                    else if (this.matchImportMeta()) {
                        return this.parseStatement();
                    }
                    else {
                        if (!this.context.isModule) {
                            this.tolerateUnexpectedToken(this.lookahead, Messages.IllegalImportDeclaration);
                        }
                        return this.parseImportDeclaration();
                    }
                }
                case 'const': return this.parseLexicalDeclaration({ inFor: false });
                case 'function': return this.parseFunctionDeclaration();
                case 'class': return this.parseClassDeclaration();
                case 'let': return this.isLexicalDeclaration() ? this.parseLexicalDeclaration({ inFor: false }) : this.parseStatement();
                default: return this.parseStatement();
            }
        }
        else {
            return this.parseStatement();
        }
    }

    parseBlock(): BlockStatement {
        const node = this.createNode();

        this.expect('{');
        const block: StatementListItem[] = [];
        while (true) {
            if (this.match('}')) {
                break;
            }
            block.push(this.parseStatementListItem());
        }
        this.expect('}');

        return this.finalize(node, new BlockStatement(block));
    }

    // https://tc39.github.io/ecma262/#sec-let-and-const-declarations

    parseLexicalBinding(kind: 'const' | 'let', options: { inFor: boolean }): VariableDeclarator {
        const node = this.createNode();
        const params: RawToken[] = [];
        const id = this.parsePattern(params, kind);

        if (this.context.strict && id.type === Syntax.Identifier) {
            if (this.scanner.isRestrictedWord((id as Identifier).name)) {
                this.tolerateError(Messages.StrictVarName);
            }
        }

        let init: Expression | null = null;
        if (kind === 'const') {
            if (!this.matchKeyword('in') && !this.matchContextualKeyword('of')) {
                if (this.match('=')) {
                    this.nextToken();
                    init = this.isolateCoverGrammar(this.parseAssignmentExpression);
                }
                else {
                    this.throwError(Messages.DeclarationMissingInitializer, 'const');
                }
            }
        }
        else if ((!options.inFor && id.type !== Syntax.Identifier) || this.match('=')) {
            this.expect('=');
            init = this.isolateCoverGrammar(this.parseAssignmentExpression);
        }

        return this.finalize(node, new VariableDeclarator(id, init));
    }

    parseBindingList(kind: 'const' | 'let', options: { inFor: boolean }): VariableDeclarator[] {
        const list = [this.parseLexicalBinding(kind, options)];

        while (this.match(',')) {
            this.nextToken();
            list.push(this.parseLexicalBinding(kind, options));
        }

        return list;
    }

    isLexicalDeclaration(): boolean {
        const state = this.scanner.saveState();
        this.scanner.scanComments();
        const next = this.scanner.lex();
        this.scanner.restoreState(state);

        return (next.type === Token.Identifier) ||
            (next.type === Token.Punctuator && next.value === '[') ||
            (next.type === Token.Punctuator && next.value === '{') ||
            (next.type === Token.Keyword && next.value === 'let') ||
            (next.type === Token.Keyword && next.value === 'yield');
    }

    /**
     * Handles the case when this.nextToken().value is 'const' or 'let'.
     */
    parseLexicalDeclaration(options: { inFor: boolean }): VariableDeclaration {
        const node = this.createNode();
        const kind = this.nextToken().value as 'const' | 'let';
        assert(kind === 'let' || kind === 'const', 'Lexical declaration must be either let or const');

        const declarations = this.parseBindingList(kind, options);
        this.consumeSemicolon();

        return this.finalize(node, new VariableDeclaration(declarations, kind));
    }

    // https://tc39.github.io/ecma262/#sec-destructuring-binding-patterns

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parseBindingRestElement(params: RawToken[], kind?: 'const' | 'let' | 'var'): RestElement {
        const node = this.createNode();

        this.expect('...');
        const arg = this.parsePattern(params, kind);

        return this.finalize(node, new RestElement(arg));
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parseArrayPattern(params: RawToken[], kind?: 'const' | 'let' | 'var'): ArrayPattern {
        const node = this.createNode();

        this.expect('[');
        const elements: ArrayPatternElement[] = [];
        while (!this.match(']')) {
            if (this.match(',')) {
                this.nextToken();
                elements.push(null);
            }
            else {
                if (this.match('...')) {
                    elements.push(this.parseBindingRestElement(params, kind));
                    break;
                }
                else {
                    elements.push(this.parsePatternWithDefault(params, kind));
                }
                if (!this.match(']')) {
                    this.expect(',');
                }
            }

        }
        this.expect(']');

        return this.finalize(node, new ArrayPattern(elements));
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parsePropertyPattern(params: RawToken[], kind?: 'const' | 'let' | 'var'): Property {
        const node = this.createNode();

        let computed = false;
        let shorthand = false;
        const method = false;

        let key: PropertyKey | null;
        let value: PropertyValue;

        if (this.lookahead.type === Token.Identifier) {
            const keyToken = this.lookahead;
            key = this.parseVariableIdentifier();
            const init = this.finalize(node, new Identifier(as_string(keyToken.value)));
            if (this.match('=')) {
                params.push(keyToken);
                shorthand = true;
                this.nextToken();
                const expr = this.parseAssignmentExpression();
                value = this.finalize(this.startNode(keyToken), new AssignmentPattern(init, expr));
            }
            else if (!this.match(':')) {
                params.push(keyToken);
                shorthand = true;
                value = init;
            }
            else {
                this.expect(':');
                value = this.parsePatternWithDefault(params, kind);
            }
        }
        else {
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            this.expect(':');
            value = this.parsePatternWithDefault(params, kind);
        }

        return this.finalize(node, new Property('init', key, computed, value, method, shorthand));
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parseRestProperty(params: RawToken[]): RestElement {
        const node = this.createNode();
        this.expect('...');
        const arg = this.parsePattern(params);
        if (this.match('=')) {
            this.throwError(Messages.DefaultRestProperty);
        }
        if (!this.match('}')) {
            this.throwError(Messages.PropertyAfterRestProperty);
        }
        return this.finalize(node, new RestElement(arg));
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parseObjectPattern(params: RawToken[], kind?: 'const' | 'let' | 'var'): ObjectPattern {
        const node = this.createNode();
        const properties: ObjectPatternProperty[] = [];

        this.expect('{');
        while (!this.match('}')) {
            properties.push(this.match('...') ? this.parseRestProperty(params) : this.parsePropertyPattern(params, kind));
            if (!this.match('}')) {
                this.expect(',');
            }
        }
        this.expect('}');

        return this.finalize(node, new ObjectPattern(properties));
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parsePattern(params: RawToken[], kind?: 'const' | 'let' | 'var'): ArrayPattern | Identifier | ObjectPattern {
        if (this.match('[')) {
            return this.parseArrayPattern(params, kind);
        }
        else if (this.match('{')) {
            return this.parseObjectPattern(params, kind);
        }
        else {
            if (this.matchKeyword('let') && (kind === 'const' || kind === 'let')) {
                this.tolerateUnexpectedToken(this.lookahead, Messages.LetInLexicalBinding);
            }
            params.push(this.lookahead);
            return this.parseVariableIdentifier(kind);
        }
    }

    /**
     * A side-effect is to push the lookahead token into `params`.
     */
    parsePatternWithDefault(params: RawToken[], kind?: 'const' | 'let' | 'var'): ArrayPattern | AssignmentPattern | Identifier | ObjectPattern {
        const startToken = this.lookahead;

        const pattern = this.parsePattern(params, kind);
        if (this.match('=')) {
            this.nextToken();
            const previousAllowYield = this.context.allowYield;
            this.context.allowYield = true;
            const right = this.isolateCoverGrammar(this.parseAssignmentExpression);
            this.context.allowYield = previousAllowYield;
            return this.finalize(this.startNode(startToken), new AssignmentPattern(pattern, right));
        }

        return pattern;
    }

    // https://tc39.github.io/ecma262/#sec-variable-statement

    parseVariableIdentifier(kind?: 'const' | 'let' | 'var'): Identifier {
        const node = this.createNode();

        const token = this.nextToken();
        if (token.type === Token.Keyword && token.value === 'yield') {
            if (this.context.strict) {
                this.tolerateUnexpectedToken(token, Messages.StrictReservedWord);
            }
            else if (!this.context.allowYield) {
                this.throwUnexpectedToken(token);
            }
        }
        else if (token.type !== Token.Identifier) {
            if (this.context.strict && token.type === Token.Keyword && this.scanner.isStrictModeReservedWord(token.value as string)) {
                this.tolerateUnexpectedToken(token, Messages.StrictReservedWord);
            }
            else {
                if (this.context.strict || token.value !== 'let' || kind !== 'var') {
                    this.throwUnexpectedToken(token);
                }
            }
        }
        else if ((this.context.isModule || this.context.isAsync) && token.type === Token.Identifier && token.value === 'await') {
            this.tolerateUnexpectedToken(token);
        }

        return this.finalize(node, new Identifier(as_string(token.value)));
    }

    parseVariableDeclaration(options: DeclarationOptions): VariableDeclarator {
        const node = this.createNode();

        const params: RawToken[] = [];
        const id = this.parsePattern(params, 'var');

        if (this.context.strict && id.type === Syntax.Identifier) {
            if (this.scanner.isRestrictedWord((id as Identifier).name)) {
                this.tolerateError(Messages.StrictVarName);
            }
        }

        let init: Expression | null = null;
        if (this.match('=')) {
            this.nextToken();
            init = this.isolateCoverGrammar(this.parseAssignmentExpression);
        }
        else if (id.type !== Syntax.Identifier && !options.inFor) {
            this.expect('=');
        }

        return this.finalize(node, new VariableDeclarator(id, init));
    }

    parseVariableDeclarationList(options: { inFor: boolean }): VariableDeclarator[] {
        const opt: DeclarationOptions = { inFor: options.inFor };

        const list: VariableDeclarator[] = [];
        list.push(this.parseVariableDeclaration(opt));
        while (this.match(',')) {
            this.nextToken();
            list.push(this.parseVariableDeclaration(opt));
        }

        return list;
    }

    parseVariableStatement(): VariableDeclaration {
        const node = this.createNode();
        this.expectKeyword('var');
        const declarations = this.parseVariableDeclarationList({ inFor: false });
        this.consumeSemicolon();

        return this.finalize(node, new VariableDeclaration(declarations, 'var'));
    }

    // https://tc39.github.io/ecma262/#sec-empty-statement

    parseEmptyStatement(): EmptyStatement {
        const node = this.createNode();
        this.expect(';');
        return this.finalize(node, new EmptyStatement());
    }

    // https://tc39.github.io/ecma262/#sec-expression-statement

    parseExpressionStatement(): ExpressionStatement {
        const node = this.createNode();
        const expr = this.parseExpression();
        this.consumeSemicolon();
        return this.finalize(node, new ExpressionStatement(expr));
    }

    // https://tc39.github.io/ecma262/#sec-if-statement

    parseIfClause(): Statement {
        if (this.context.strict && this.matchKeyword('function')) {
            this.tolerateError(Messages.StrictFunction);
        }
        return this.parseStatement();
    }

    parseIfStatement(): IfStatement {
        const node = this.createNode();
        let consequent: Statement;
        let alternate: Statement | null = null;

        this.expectKeyword('if');
        this.expect('(');
        const test = this.parseExpression();

        if (!this.match(')') && this.config.tolerant) {
            this.tolerateUnexpectedToken(this.nextToken());
            consequent = this.finalize(this.createNode(), new EmptyStatement());
        }
        else {
            this.expect(')');
            consequent = this.parseIfClause();
            if (this.matchKeyword('else')) {
                this.nextToken();
                alternate = this.parseIfClause();
            }
        }

        return this.finalize(node, new IfStatement(test, consequent, alternate));
    }

    // https://tc39.github.io/ecma262/#sec-do-while-statement

    parseDoWhileStatement(): DoWhileStatement {
        const node = this.createNode();
        this.expectKeyword('do');

        this.tolerateInvalidLoopStatement();

        const previousInIteration = this.context.inIteration;
        this.context.inIteration = true;
        const body = this.parseStatement();
        this.context.inIteration = previousInIteration;

        this.expectKeyword('while');
        this.expect('(');
        const test = this.parseExpression();

        if (!this.match(')') && this.config.tolerant) {
            this.tolerateUnexpectedToken(this.nextToken());
        }
        else {
            this.expect(')');
            if (this.match(';')) {
                this.nextToken();
            }
        }

        return this.finalize(node, new DoWhileStatement(body, test));
    }

    // https://tc39.github.io/ecma262/#sec-while-statement

    parseWhileStatement(): WhileStatement {
        const node = this.createNode();

        this.expectKeyword('while');
        this.expect('(');
        const test = this.parseExpression();

        if (!this.match(')') && this.config.tolerant) {
            this.tolerateUnexpectedToken(this.nextToken());
            const body = this.finalize(this.createNode(), new EmptyStatement());
            return this.finalize(node, new WhileStatement(test, body));
        }
        else {
            this.expect(')');

            const previousInIteration = this.context.inIteration;
            this.context.inIteration = true;
            const body = this.parseStatement();
            this.context.inIteration = previousInIteration;
            return this.finalize(node, new WhileStatement(test, body));
        }
    }

    // https://tc39.github.io/ecma262/#sec-for-statement
    // https://tc39.github.io/ecma262/#sec-for-in-and-for-of-statements

    parseForStatement(): ForStatement | ForInStatement | ForOfStatement {
        let init: VariableDeclaration | SequenceExpression | Expression | null = null;
        let test: Expression | null = null;
        let update: Expression | null = null;
        let forIn = true;
        let left: Expression | undefined;
        let right: Expression | undefined;
        let _await = false;

        const node = this.createNode();
        this.expectKeyword('for');
        if (this.matchContextualKeyword('await')) {
            if (!this.context.isAsync) {
                this.tolerateUnexpectedToken(this.lookahead);
            }
            _await = true;
            this.nextToken();
        }

        this.expect('(');

        if (this.match(';')) {
            this.nextToken();
        }
        else {
            if (this.matchKeyword('var')) {
                const marker = this.createNode();
                this.nextToken();

                const previousAllowIn = this.context.allowIn;
                this.context.allowIn = false;
                const declarations = this.parseVariableDeclarationList({ inFor: true });
                this.context.allowIn = previousAllowIn;

                if (!_await && declarations.length === 1 && this.matchKeyword('in')) {
                    const decl = declarations[0];
                    if (decl.init && (decl.id.type === Syntax.ArrayPattern || decl.id.type === Syntax.ObjectPattern || this.context.strict)) {
                        this.tolerateError(Messages.ForInOfLoopInitializer, 'for-in');
                    }
                    left = this.finalize(marker, new VariableDeclaration(declarations, 'var'));
                    this.nextToken();
                    right = this.parseExpression();
                    init = null;
                }
                else if (declarations.length === 1 && declarations[0].init === null && this.matchContextualKeyword('of')) {
                    left = this.finalize(marker, new VariableDeclaration(declarations, 'var'));
                    this.nextToken();
                    right = this.parseAssignmentExpression();
                    init = null;
                    forIn = false;
                }
                else {
                    init = this.finalize(marker, new VariableDeclaration(declarations, 'var'));
                    this.expect(';');
                }
            }
            else if (this.matchKeyword('const') || this.matchKeyword('let')) {
                const marker = this.createNode();
                const kind = <'const' | 'let'>as_string(this.nextToken().value);

                if (!this.context.strict && this.lookahead.value === 'in') {
                    left = this.finalize(marker, new Identifier(kind));
                    this.nextToken();
                    right = this.parseExpression();
                    init = null;
                }
                else {
                    const previousAllowIn = this.context.allowIn;
                    this.context.allowIn = false;
                    const declarations = this.parseBindingList(kind, { inFor: true });
                    this.context.allowIn = previousAllowIn;

                    if (declarations.length === 1 && declarations[0].init === null && this.matchKeyword('in')) {
                        left = this.finalize(marker, new VariableDeclaration(declarations, kind));
                        this.nextToken();
                        right = this.parseExpression();
                        init = null;
                    }
                    else if (declarations.length === 1 && declarations[0].init === null && this.matchContextualKeyword('of')) {
                        left = this.finalize(marker, new VariableDeclaration(declarations, kind));
                        this.nextToken();
                        right = this.parseAssignmentExpression();
                        init = null;
                        forIn = false;
                    }
                    else {
                        this.consumeSemicolon();
                        init = this.finalize(marker, new VariableDeclaration(declarations, kind));
                    }
                }
            }
            else {
                const initStartToken = this.lookahead;
                const previousIsBindingElement = this.context.isBindingElement;
                const previousIsAssignmentTarget = this.context.isAssignmentTarget;
                const previousFirstCoverInitializedNameError = this.context.firstCoverInitializedNameError;

                const previousAllowIn = this.context.allowIn;
                this.context.allowIn = false;
                init = this.inheritCoverGrammar(this.parseAssignmentExpression);
                this.context.allowIn = previousAllowIn;

                if (this.matchKeyword('in')) {
                    if (!this.context.isAssignmentTarget || init.type === Syntax.AssignmentExpression) {
                        this.tolerateError(Messages.InvalidLHSInForIn);
                    }

                    this.nextToken();
                    this.reinterpretExpressionAsPattern(init);
                    left = init;
                    right = this.parseExpression();
                    init = null;
                }
                else if (this.matchContextualKeyword('of')) {
                    if (!this.context.isAssignmentTarget || init.type === Syntax.AssignmentExpression) {
                        this.tolerateError(Messages.InvalidLHSInForLoop);
                    }

                    this.nextToken();
                    this.reinterpretExpressionAsPattern(init);
                    left = init;
                    right = this.parseAssignmentExpression();
                    init = null;
                    forIn = false;
                }
                else {
                    // The `init` node was not parsed isolated, but we would have wanted it to.
                    this.context.isBindingElement = previousIsBindingElement;
                    this.context.isAssignmentTarget = previousIsAssignmentTarget;
                    this.context.firstCoverInitializedNameError = previousFirstCoverInitializedNameError;

                    if (this.match(',')) {
                        const initSeq = [init];
                        while (this.match(',')) {
                            this.nextToken();
                            initSeq.push(this.isolateCoverGrammar(this.parseAssignmentExpression));
                        }
                        init = this.finalize(this.startNode(initStartToken), new SequenceExpression(initSeq));
                    }
                    this.expect(';');
                }
            }
        }

        if (typeof left === 'undefined') {
            if (!this.match(';')) {
                test = this.isolateCoverGrammar(this.parseExpression);
            }
            this.expect(';');
            if (!this.match(')')) {
                update = this.isolateCoverGrammar(this.parseExpression);
            }
        }

        const body = this.parseBodyStatement();

        return (typeof left === 'undefined') ?
            this.finalize(node, new ForStatement(init, test, update, body)) :
            forIn ? this.finalize(node, new ForInStatement(left, right as Expression, body)) :
                this.finalize(node, new ForOfStatement(left, right as Expression, body, _await));
    }

    parseBodyStatement(): Statement {
        if (!this.match(')') && this.config.tolerant) {
            this.tolerateUnexpectedToken(this.nextToken());
            return this.finalize(this.createNode(), new EmptyStatement());
        }
        else {
            this.expect(')');

            const previousInIteration = this.context.inIteration;
            this.context.inIteration = true;
            try {
                return this.isolateCoverGrammar(this.parseStatement);
            }
            finally {
                this.context.inIteration = previousInIteration;
            }
        }
    }

    // https://tc39.github.io/ecma262/#sec-continue-statement

    parseContinueStatement(): ContinueStatement {
        const node = this.createNode();
        this.expectKeyword('continue');

        let label: Identifier | null = null;
        if (this.lookahead.type === Token.Identifier && !this.hasLineTerminator) {
            const id = this.parseVariableIdentifier();
            label = id;

            const key = '$' + id.name;
            if (!Object.prototype.hasOwnProperty.call(this.context.labelSet, key)) {
                this.throwError(Messages.UnknownLabel, id.name);
            }
        }

        this.consumeSemicolon();
        if (label === null && !this.context.inIteration) {
            this.throwError(Messages.IllegalContinue);
        }

        return this.finalize(node, new ContinueStatement(label));
    }

    // https://tc39.github.io/ecma262/#sec-break-statement

    parseBreakStatement(): BreakStatement {
        const node = this.createNode();
        this.expectKeyword('break');

        let label: Identifier | null = null;
        if (this.lookahead.type === Token.Identifier && !this.hasLineTerminator) {
            const id = this.parseVariableIdentifier();

            const key = '$' + id.name;
            if (!Object.prototype.hasOwnProperty.call(this.context.labelSet, key)) {
                this.throwError(Messages.UnknownLabel, id.name);
            }
            label = id;
        }

        this.consumeSemicolon();
        if (label === null && !this.context.inIteration && !this.context.inSwitch) {
            this.throwError(Messages.IllegalBreak);
        }

        return this.finalize(node, new BreakStatement(label));
    }

    // https://tc39.github.io/ecma262/#sec-return-statement

    parseReturnStatement(): ReturnStatement {
        if (!this.context.inFunctionBody) {
            this.tolerateError(Messages.IllegalReturn);
        }

        const node = this.createNode();
        this.expectKeyword('return');

        const hasArgument = (!this.match(';') && !this.match('}') &&
            !this.hasLineTerminator && this.lookahead.type !== Token.EOF) ||
            this.lookahead.type === Token.StringLiteral ||
            this.lookahead.type === Token.Template;

        const argument = hasArgument ? this.parseExpression() : null;
        this.consumeSemicolon();

        return this.finalize(node, new ReturnStatement(argument));
    }

    // https://tc39.github.io/ecma262/#sec-with-statement

    parseWithStatement(): WithStatement {
        if (this.context.strict) {
            this.tolerateError(Messages.StrictModeWith);
        }

        const node = this.createNode();

        this.expectKeyword('with');
        this.expect('(');
        const object = this.parseExpression();

        if (!this.match(')') && this.config.tolerant) {
            this.tolerateUnexpectedToken(this.nextToken());
            const body = this.finalize(this.createNode(), new EmptyStatement());
            return this.finalize(node, new WithStatement(object, body));
        }
        else {
            this.expect(')');
            const body = this.parseStatement();
            return this.finalize(node, new WithStatement(object, body));
        }
    }

    // https://tc39.github.io/ecma262/#sec-switch-statement

    parseSwitchCase(): SwitchCase {
        const node = this.createNode();

        let test: Expression | null;
        if (this.matchKeyword('default')) {
            this.nextToken();
            test = null;
        }
        else {
            this.expectKeyword('case');
            test = this.parseExpression();
        }
        this.expect(':');

        const consequent: StatementListItem[] = [];
        while (true) {
            if (this.match('}') || this.matchKeyword('default') || this.matchKeyword('case')) {
                break;
            }
            consequent.push(this.parseStatementListItem());
        }

        return this.finalize(node, new SwitchCase(test, consequent));
    }

    parseSwitchStatement(): SwitchStatement {
        const node = this.createNode();
        this.expectKeyword('switch');

        this.expect('(');
        const discriminant = this.parseExpression();
        this.expect(')');

        const previousInSwitch = this.context.inSwitch;
        this.context.inSwitch = true;

        const cases: SwitchCase[] = [];
        let defaultFound = false;
        this.expect('{');
        while (true) {
            if (this.match('}')) {
                break;
            }
            const clause = this.parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    this.throwError(Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }
        this.expect('}');

        this.context.inSwitch = previousInSwitch;

        return this.finalize(node, new SwitchStatement(discriminant, cases));
    }

    // https://tc39.github.io/ecma262/#sec-labelled-statements

    parseLabelledStatement(): LabeledStatement | ExpressionStatement {
        const marker = this.createNode();
        const expr = this.parseExpression();

        if ((is_identifier(expr)) && this.match(':')) {
            this.nextToken();

            const key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(this.context.labelSet, key)) {
                this.throwError(Messages.Redeclaration, 'Label', expr.name);
            }

            this.context.labelSet[key] = true;
            let body: Statement;
            if (this.matchKeyword('class')) {
                this.tolerateUnexpectedToken(this.lookahead);
                body = this.parseClassDeclaration();
            }
            else if (this.matchKeyword('function')) {
                const token = this.lookahead;
                const declaration = this.parseFunctionDeclaration();
                if (this.context.strict) {
                    this.tolerateUnexpectedToken(token, Messages.StrictFunction);
                }
                else if (declaration.generator) {
                    this.tolerateUnexpectedToken(token, Messages.GeneratorInLegacyContext);
                }
                body = declaration;
            }
            else {
                body = this.parseStatement();
            }
            delete this.context.labelSet[key];

            return this.finalize(marker, new LabeledStatement(expr, body));
        }
        else {
            this.consumeSemicolon();
            return this.finalize(marker, new ExpressionStatement(expr));
        }
    }

    // https://tc39.github.io/ecma262/#sec-throw-statement

    parseThrowStatement(): ThrowStatement {
        const node = this.createNode();
        this.expectKeyword('throw');

        if (this.hasLineTerminator) {
            this.throwError(Messages.NewlineAfterThrow);
        }

        const argument = this.parseExpression();
        this.consumeSemicolon();

        return this.finalize(node, new ThrowStatement(argument));
    }

    // https://tc39.github.io/ecma262/#sec-try-statement

    parseCatchClause(): CatchClause {
        const node = this.createNode();

        this.expectKeyword('catch');

        let param: BindingIdentifier | BindingPattern | null = null;
        if (this.match('(')) {
            this.expect('(');
            if (this.match(')')) {
                this.throwUnexpectedToken(this.lookahead);
            }

            const params: RawToken[] = [];
            param = this.parsePattern(params);
            const paramMap: { [key: string]: boolean } = {};
            for (let i = 0; i < params.length; i++) {
                const key = '$' + params[i].value;
                if (Object.prototype.hasOwnProperty.call(paramMap, key)) {
                    this.tolerateError(Messages.DuplicateBinding, params[i].value);
                }
                paramMap[key] = true;
            }

            if (this.context.strict && param.type === Syntax.Identifier) {
                if (this.scanner.isRestrictedWord((param as Identifier).name)) {
                    this.tolerateError(Messages.StrictCatchVariable);
                }
            }

            this.expect(')');
        }
        const body = this.parseBlock();

        return this.finalize(node, new CatchClause(param, body));
    }

    parseFinallyClause(): BlockStatement {
        this.expectKeyword('finally');
        return this.parseBlock();
    }

    parseTryStatement(): TryStatement {
        const node = this.createNode();
        this.expectKeyword('try');

        const block = this.parseBlock();
        const handler = this.matchKeyword('catch') ? this.parseCatchClause() : null;
        const finalizer = this.matchKeyword('finally') ? this.parseFinallyClause() : null;

        if (!handler && !finalizer) {
            this.throwError(Messages.NoCatchOrFinally);
        }

        return this.finalize(node, new TryStatement(block, handler, finalizer));
    }

    // https://tc39.github.io/ecma262/#sec-debugger-statement

    parseDebuggerStatement(): DebuggerStatement {
        const node = this.createNode();
        this.expectKeyword('debugger');
        this.consumeSemicolon();
        return this.finalize(node, new DebuggerStatement());
    }

    // https://tc39.github.io/ecma262/#sec-ecmascript-language-statements-and-declarations

    parseStatement(): Statement {
        let statement: Statement;
        switch (this.lookahead.type) {
            case Token.BooleanLiteral:
            case Token.NullLiteral:
            case Token.NumericLiteral:
            case Token.StringLiteral:
            case Token.Template:
            case Token.RegularExpression:
                statement = this.parseExpressionStatement();
                break;

            case Token.Punctuator: {
                const value = this.lookahead.value;
                if (value === '{') {
                    statement = this.parseBlock();
                }
                else if (value === '(') {
                    statement = this.parseExpressionStatement();
                }
                else if (value === ';') {
                    statement = this.parseEmptyStatement();
                }
                else {
                    statement = this.parseExpressionStatement();
                }
                break;
            }
            case Token.Identifier:
                statement = this.matchAsyncFunction() ? this.parseFunctionDeclaration() : this.parseLabelledStatement();
                break;

            case Token.Keyword:
                switch (this.lookahead.value) {
                    case 'break':
                        statement = this.parseBreakStatement();
                        break;
                    case 'continue':
                        statement = this.parseContinueStatement();
                        break;
                    case 'debugger':
                        statement = this.parseDebuggerStatement();
                        break;
                    case 'do':
                        statement = this.parseDoWhileStatement();
                        break;
                    case 'for':
                        statement = this.parseForStatement();
                        break;
                    case 'function':
                        statement = this.parseFunctionDeclaration();
                        break;
                    case 'if':
                        statement = this.parseIfStatement();
                        break;
                    case 'return':
                        statement = this.parseReturnStatement();
                        break;
                    case 'switch':
                        statement = this.parseSwitchStatement();
                        break;
                    case 'throw':
                        statement = this.parseThrowStatement();
                        break;
                    case 'try':
                        statement = this.parseTryStatement();
                        break;
                    case 'var':
                        statement = this.parseVariableStatement();
                        break;
                    case 'while':
                        statement = this.parseWhileStatement();
                        break;
                    case 'with':
                        statement = this.parseWithStatement();
                        break;
                    default:
                        statement = this.parseExpressionStatement();
                        break;
                }
                break;

            default:
                statement = this.throwUnexpectedToken(this.lookahead);
        }

        return statement;
    }

    // https://tc39.github.io/ecma262/#sec-function-definitions

    parseFunctionSourceElements(): BlockStatement {
        const node = this.createNode();

        this.expect('{');
        const body = this.parseDirectivePrologues();

        const previousLabelSet = this.context.labelSet;
        const previousInIteration = this.context.inIteration;
        const previousInSwitch = this.context.inSwitch;
        const previousInFunctionBody = this.context.inFunctionBody;

        this.context.labelSet = {};
        this.context.inIteration = false;
        this.context.inSwitch = false;
        this.context.inFunctionBody = true;

        while (this.lookahead.type !== Token.EOF) {
            if (this.match('}')) {
                break;
            }
            body.push(this.parseStatementListItem());
        }

        this.expect('}');

        this.context.labelSet = previousLabelSet;
        this.context.inIteration = previousInIteration;
        this.context.inSwitch = previousInSwitch;
        this.context.inFunctionBody = previousInFunctionBody;

        return this.finalize(node, new BlockStatement(body));
    }

    /**
     * The side-effect of calling this method is to modify options.
     */
    validateParam(options: FormalParameters, param: RawToken, name: string): void {
        const key = '$' + name;
        if (this.context.strict) {
            if (this.scanner.isRestrictedWord(name)) {
                options.stricted = param;
                options.message = Messages.StrictParamName;
            }
            if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.stricted = param;
                options.hasDuplicateParameterNames = true;
            }
        }
        else if (!options.firstRestricted) {
            if (this.scanner.isRestrictedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictParamName;
            }
            else if (this.scanner.isStrictModeReservedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictReservedWord;
            }
            else if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.stricted = param;
                options.hasDuplicateParameterNames = true;
            }
        }

        /* istanbul ignore next */
        if (typeof Object.defineProperty === 'function') {
            Object.defineProperty(options.paramSet, key, { value: true, enumerable: true, writable: true, configurable: true });
        }
        else {
            if (options.paramSet) {
                options.paramSet[key] = true;
            }
            else {
                options.paramSet = { key: true };
            }
        }
    }

    parseRestElement(params: RawToken[]): RestElement {
        const node = this.createNode();

        this.expect('...');
        const arg = this.parsePattern(params);
        if (this.match('=')) {
            this.throwError(Messages.DefaultRestParameter);
        }
        if (!this.match(')')) {
            this.throwError(Messages.ParameterAfterRestParameter);
        }

        return this.finalize(node, new RestElement(arg));
    }

    /**
     * The side effect of calling this method is to modify options.
     */
    parseFormalParameter(options: FormalParameters): void {
        const params: RawToken[] = [];
        const param = this.match('...') ? this.parseRestElement(params) : this.parsePatternWithDefault(params);
        for (let i = 0; i < params.length; i++) {
            this.validateParam(options, params[i], as_string(params[i].value));
        }
        options.simple = options.simple && (param instanceof Identifier);
        options.params.push(param as FunctionParameter);
    }

    parseFormalParameters(firstRestricted?: RawToken): FormalParameters {
        const options: FormalParameters = {
            simple: true,
            hasDuplicateParameterNames: false,
            params: [],
            firstRestricted: firstRestricted
        };

        this.expect('(');
        if (!this.match(')')) {
            options.paramSet = {};
            while (this.lookahead.type !== Token.EOF) {
                this.parseFormalParameter(options);
                if (this.match(')')) {
                    break;
                }
                this.expect(',');
                if (this.match(')')) {
                    break;
                }
            }
        }
        this.expect(')');

        if (options.hasDuplicateParameterNames) {
            if (this.context.strict || this.context.isAsync || !options.simple) {
                this.throwError(Messages.DuplicateParameter);
            }
        }

        return {
            simple: options.simple,
            params: options.params,
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
        };
    }

    matchAsyncFunction(): boolean {
        const match = this.matchContextualKeyword('async');
        if (match) {
            const state = this.scanner.saveState();
            this.scanner.scanComments();
            try {
                const next = this.scanner.lex();
                return (state.lineNumber === next.lineNumber) && (next.type === Token.Keyword) && (next.value === 'function');
            }
            finally {
                this.scanner.restoreState(state);
            }
        }
        else {
            return match;
        }
    }

    parseFunctionDeclaration(identifierIsOptional?: boolean): AsyncFunctionDeclaration | FunctionDeclaration {
        const node = this.createNode();

        const isAsync = this.matchContextualKeyword('async');
        if (isAsync) {
            if (this.context.inIteration) {
                this.tolerateError(Messages.AsyncFunctionInSingleStatementContext);
            }
            this.nextToken();
        }

        this.expectKeyword('function');

        const isGenerator = this.match('*');
        if (isGenerator) {
            this.nextToken();
        }

        let message: string | undefined;
        let id: Identifier | null = null;
        let firstRestricted: RawToken | undefined;

        if (!identifierIsOptional || !this.match('(')) {
            const token = this.lookahead;
            id = this.parseVariableIdentifier();
            if (this.context.strict) {
                if (this.scanner.isRestrictedWord(token.value as string)) {
                    this.tolerateUnexpectedToken(token, Messages.StrictFunctionName);
                }
            }
            else {
                if (this.scanner.isRestrictedWord(token.value as string)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                }
                else if (this.scanner.isStrictModeReservedWord(token.value as string)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        const previousIsAsync = this.context.isAsync;
        const previousAllowYield = this.context.allowYield;
        this.context.isAsync = isAsync;
        this.context.allowYield = !isGenerator;

        const formalParameters = this.parseFormalParameters(firstRestricted);
        const params = formalParameters.params;
        const stricted = formalParameters.stricted;
        firstRestricted = formalParameters.firstRestricted;
        if (formalParameters.message) {
            message = formalParameters.message;
        }

        const previousStrict = this.context.strict;
        const previousAllowStrictDirective = this.context.allowStrictDirective;
        this.context.allowStrictDirective = formalParameters.simple;
        const body = this.parseFunctionSourceElements();
        if (this.context.strict && firstRestricted) {
            this.throwUnexpectedToken(firstRestricted, message);
        }
        if (this.context.strict && stricted) {
            this.tolerateUnexpectedToken(stricted, message);
        }

        this.context.strict = previousStrict;
        this.context.allowStrictDirective = previousAllowStrictDirective;
        this.context.isAsync = previousIsAsync;
        this.context.allowYield = previousAllowYield;

        return isAsync
            ? this.finalize(node, new AsyncFunctionDeclaration(id, params, body, isGenerator))
            : this.finalize(node, new FunctionDeclaration(id, params, body, isGenerator));
    }

    parseFunctionExpression(): FunctionExpression {
        const node = this.createNode();

        const isAsync = this.matchContextualKeyword('async');
        if (isAsync) {
            this.nextToken();
        }

        this.expectKeyword('function');

        const isGenerator = this.match('*');
        if (isGenerator) {
            this.nextToken();
        }

        let message: string | undefined;
        let id: Identifier | null = null;
        let firstRestricted: RawToken | undefined;

        const previousIsAsync = this.context.isAsync;
        const previousAllowYield = this.context.allowYield;
        this.context.isAsync = isAsync;
        this.context.allowYield = !isGenerator;

        if (!this.match('(')) {
            const token = this.lookahead;
            id = (!this.context.strict && !isGenerator && this.matchKeyword('yield')) ? this.parseIdentifierName() : this.parseVariableIdentifier();
            if (this.context.strict) {
                if (this.scanner.isRestrictedWord(token.value as string)) {
                    this.tolerateUnexpectedToken(token, Messages.StrictFunctionName);
                }
            }
            else {
                if (this.scanner.isRestrictedWord(token.value as string)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                }
                else if (this.scanner.isStrictModeReservedWord(token.value as string)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        const formalParameters = this.parseFormalParameters(firstRestricted);
        const params = formalParameters.params;
        const stricted = formalParameters.stricted;
        firstRestricted = formalParameters.firstRestricted;
        if (formalParameters.message) {
            message = formalParameters.message;
        }

        const previousStrict = this.context.strict;
        const previousAllowStrictDirective = this.context.allowStrictDirective;
        this.context.allowStrictDirective = formalParameters.simple;
        const body = this.parseFunctionSourceElements();
        if (this.context.strict && firstRestricted) {
            this.throwUnexpectedToken(firstRestricted, message);
        }
        if (this.context.strict && stricted) {
            this.tolerateUnexpectedToken(stricted, message);
        }
        this.context.strict = previousStrict;
        this.context.allowStrictDirective = previousAllowStrictDirective;
        this.context.isAsync = previousIsAsync;
        this.context.allowYield = previousAllowYield;

        return this.finalize(node, new FunctionExpression(id, params, body, isGenerator, isAsync));
    }

    // https://tc39.github.io/ecma262/#sec-directive-prologues-and-the-use-strict-directive

    parseDirective(): Directive | ExpressionStatement {
        const token = this.lookahead;

        const node = this.createNode();
        const expr = this.parseExpression();
        const directive = (expr.type === Syntax.Literal) ? this.getTokenRaw(token).slice(1, -1) : null;
        this.consumeSemicolon();

        return this.finalize(node, directive ? new Directive(expr, directive) : new ExpressionStatement(expr));
    }

    parseDirectivePrologues(): Statement[] {
        let firstRestricted: RawToken | null = null;

        const body: Statement[] = [];
        while (true) {
            const token = this.lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            const statement = this.parseDirective();
            body.push(statement);
            const directive = (statement as Directive).directive;
            if (typeof directive !== 'string') {
                break;
            }

            if (directive === 'use strict') {
                this.context.strict = true;
                if (firstRestricted) {
                    this.tolerateUnexpectedToken(firstRestricted, Messages.StrictOctalLiteral);
                }
                if (!this.context.allowStrictDirective) {
                    this.tolerateUnexpectedToken(token, Messages.IllegalLanguageModeDirective);
                }
            }
            else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        return body;
    }

    // https://tc39.github.io/ecma262/#sec-method-definitions

    qualifiedPropertyName(token: RawToken): boolean {
        switch (token.type) {
            case Token.Identifier:
            case Token.StringLiteral:
            case Token.BooleanLiteral:
            case Token.NullLiteral:
            case Token.NumericLiteral:
            case Token.Keyword:
                return true;
            case Token.Punctuator:
                return token.value === '[';
            default:
                break;
        }
        return false;
    }

    parseGetterMethod(): FunctionExpression {
        const node = this.createNode();

        const isGenerator = false;
        const previousAllowYield = this.context.allowYield;
        this.context.allowYield = !isGenerator;
        const formalParameters = this.parseFormalParameters();
        if (formalParameters.params.length > 0) {
            this.tolerateError(Messages.BadGetterArity);
        }
        const method = this.parsePropertyMethod(formalParameters);
        this.context.allowYield = previousAllowYield;

        return this.finalize(node, new FunctionExpression(null, formalParameters.params, method, isGenerator, false));
    }

    parseSetterMethod(): FunctionExpression {
        const node = this.createNode();

        const isGenerator = false;
        const previousAllowYield = this.context.allowYield;
        this.context.allowYield = !isGenerator;
        const formalParameters = this.parseFormalParameters();
        if (formalParameters.params.length !== 1) {
            this.tolerateError(Messages.BadSetterArity);
        }
        else if (formalParameters.params[0] instanceof RestElement) {
            this.tolerateError(Messages.BadSetterRestParameter);
        }
        const method = this.parsePropertyMethod(formalParameters);
        this.context.allowYield = previousAllowYield;

        return this.finalize(node, new FunctionExpression(null, formalParameters.params, method, isGenerator, false));
    }

    parseGeneratorMethod(): FunctionExpression {
        const node = this.createNode();

        const isGenerator = true;
        const previousAllowYield = this.context.allowYield;

        this.context.allowYield = true;
        const params = this.parseFormalParameters();
        this.context.allowYield = false;
        const method = this.parsePropertyMethod(params);
        this.context.allowYield = previousAllowYield;

        return this.finalize(node, new FunctionExpression(null, params.params, method, isGenerator, false));
    }

    // https://tc39.github.io/ecma262/#sec-generator-function-definitions

    isStartOfExpression(): boolean {
        let start = true;

        const value = this.lookahead.value;
        switch (this.lookahead.type) {
            case Token.Punctuator:
                start = (value === '[') || (value === '(') || (value === '{') ||
                    (value === '+') || (value === '-') ||
                    (value === '!') || (value === '~') ||
                    (value === '++') || (value === '--') ||
                    (value === '/') || (value === '/=');  // regular expression literal
                break;

            case Token.Keyword:
                start = (value === 'class') || (value === 'delete') ||
                    (value === 'function') || (value === 'let') || (value === 'new') ||
                    (value === 'super') || (value === 'this') || (value === 'typeof') ||
                    (value === 'void') || (value === 'yield');
                break;

            default:
                break;
        }

        return start;
    }

    parseYieldExpression(): YieldExpression {
        const node = this.createNode();
        this.expectKeyword('yield');

        let argument: Expression | null = null;
        let delegate = false;
        if (!this.hasLineTerminator) {
            const previousAllowYield = this.context.allowYield;
            this.context.allowYield = false;
            delegate = this.match('*');
            if (delegate) {
                this.nextToken();
                argument = this.parseAssignmentExpression();
            }
            else if (this.isStartOfExpression()) {
                argument = this.parseAssignmentExpression();
            }
            this.context.allowYield = previousAllowYield;
        }

        return this.finalize(node, new YieldExpression(argument, delegate));
    }

    // https://tc39.github.io/ecma262/#sec-class-definitions

    parseClassElement(hasConstructor: { value: boolean }): Property | MethodDefinition {
        let token = this.lookahead;
        const node = this.createNode();

        let kind = '';
        let key: Identifier | Literal | Expression | null = null;
        let value: FunctionExpression | null = null;
        let computed = false;
        let method = false;
        let isStatic = false;
        let isAsync = false;
        let isGenerator = false;

        if (this.match('*')) {
            this.nextToken();
        }
        else {
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            const id = key as Identifier;
            if (id.name === 'static' && (this.qualifiedPropertyName(this.lookahead) || this.match('*'))) {
                token = this.lookahead;
                isStatic = true;
                computed = this.match('[');
                if (this.match('*')) {
                    this.nextToken();
                }
                else {
                    key = this.parseObjectPropertyKey();
                }
            }
            if ((token.type === Token.Identifier) && !this.hasLineTerminator && (token.value === 'async')) {
                const punctuator = this.lookahead.value;
                if (punctuator !== ':' && punctuator !== '(') {
                    isAsync = true;
                    isGenerator = this.match("*");
                    if (isGenerator) {
                        this.nextToken();
                    }
                    token = this.lookahead;
                    computed = this.match('[');
                    key = this.parseObjectPropertyKey();
                    if (token.type === Token.Identifier && token.value === 'constructor') {
                        this.tolerateUnexpectedToken(token, Messages.ConstructorIsAsync);
                    }
                }
            }
        }

        const lookaheadPropertyKey = this.qualifiedPropertyName(this.lookahead);
        if (token.type === Token.Identifier) {
            if (token.value === 'get' && lookaheadPropertyKey) {
                kind = 'get';
                computed = this.match('[');
                key = this.parseObjectPropertyKey();
                this.context.allowYield = false;
                value = this.parseGetterMethod();
            }
            else if (token.value === 'set' && lookaheadPropertyKey) {
                kind = 'set';
                computed = this.match('[');
                key = this.parseObjectPropertyKey();
                value = this.parseSetterMethod();
            }
        }
        else if (token.type === Token.Punctuator && token.value === '*' && lookaheadPropertyKey) {
            kind = 'init';
            computed = this.match('[');
            key = this.parseObjectPropertyKey();
            value = this.parseGeneratorMethod();
            method = true;
        }

        if (!kind && key && this.match('(')) {
            const previousInClassConstructor = this.context.inClassConstructor;
            this.context.inClassConstructor = token.value === 'constructor';
            kind = 'init';
            value = isAsync ? this.parsePropertyMethodAsyncFunction(isGenerator) : this.parsePropertyMethodFunction(isGenerator);
            this.context.inClassConstructor = previousInClassConstructor;
            method = true;
        }

        if (!kind) {
            this.throwUnexpectedToken(this.lookahead);
        }

        if (kind === 'init') {
            kind = 'method';
        }

        if (!computed) {
            if (isStatic && this.isPropertyKey(key, 'prototype')) {
                this.throwUnexpectedToken(token, Messages.StaticPrototype);
            }
            if (!isStatic && this.isPropertyKey(key, 'constructor')) {
                if (kind !== 'method' || !method || (value && value.generator)) {
                    this.throwUnexpectedToken(token, Messages.ConstructorSpecialMethod);
                }
                if (hasConstructor.value) {
                    this.throwUnexpectedToken(token, Messages.DuplicateConstructor);
                }
                else {
                    hasConstructor.value = true;
                }
                kind = 'constructor';
            }
        }

        return this.finalize(node, new MethodDefinition(key, computed, value, kind, isStatic));
    }

    parseClassElementList(): (Property | MethodDefinition)[] {
        const body: (Property | MethodDefinition)[] = [];
        const hasConstructor = { value: false };

        this.expect('{');
        while (!this.match('}')) {
            if (this.match(';')) {
                this.nextToken();
            }
            else {
                body.push(this.parseClassElement(hasConstructor));
            }
        }
        this.expect('}');

        return body;
    }

    parseClassBody(): ClassBody {
        const node = this.createNode();
        const elementList = this.parseClassElementList();

        return this.finalize(node, new ClassBody(elementList));
    }

    parseClassDeclaration(identifierIsOptional?: boolean): ClassDeclaration {
        const node = this.createNode();

        const previousStrict = this.context.strict;
        this.context.strict = true;
        this.expectKeyword('class');

        const id = (identifierIsOptional && (this.lookahead.type !== Token.Identifier)) ? null : this.parseVariableIdentifier();
        let superClass: Identifier | null = null;
        if (this.matchKeyword('extends')) {
            this.nextToken();
            superClass = this.isolateCoverGrammar(this.parseLeftHandSideExpressionAllowCall) as Identifier;
        }
        const classBody = this.parseClassBody();
        this.context.strict = previousStrict;

        return this.finalize(node, new ClassDeclaration(id, superClass, classBody));
    }

    parseClassExpression(): ClassExpression {
        const node = this.createNode();

        const previousStrict = this.context.strict;
        this.context.strict = true;
        this.expectKeyword('class');
        const id = (this.lookahead.type === Token.Identifier) ? this.parseVariableIdentifier() : null;
        let superClass: Identifier | null = null;
        if (this.matchKeyword('extends')) {
            this.nextToken();
            superClass = this.isolateCoverGrammar(this.parseLeftHandSideExpressionAllowCall) as Identifier;
        }
        const classBody = this.parseClassBody();
        this.context.strict = previousStrict;

        return this.finalize(node, new ClassExpression(id, superClass, classBody));
    }

    // https://tc39.github.io/ecma262/#sec-scripts
    // https://tc39.github.io/ecma262/#sec-modules

    parseModule(): Module {
        this.context.strict = true;
        this.context.isModule = true;
        this.scanner.isModule = true;
        const node = this.createNode();
        const body = this.parseDirectivePrologues();
        while (this.lookahead.type !== Token.EOF) {
            body.push(this.parseStatementListItem());
        }
        return this.finalize(node, new Module(body));
    }

    parseScript(): Script {
        const node = this.createNode();
        const body = this.parseDirectivePrologues();
        while (this.lookahead.type !== Token.EOF) {
            body.push(this.parseStatementListItem());
        }
        return this.finalize(node, new Script(body));
    }

    // https://tc39.github.io/ecma262/#sec-imports

    parseModuleSpecifier(): Literal {
        const node = this.createNode();

        if (this.lookahead.type !== Token.StringLiteral) {
            this.throwError(Messages.InvalidModuleSpecifier);
        }

        const token = this.nextToken();
        const raw = this.getTokenRaw(token);
        return this.finalize(node, new Literal(token.value as string, raw));
    }

    // import {<foo as bar>} ...;
    parseImportSpecifier(): ImportSpecifier {
        const node = this.createNode();

        let imported: Identifier;
        let local: Identifier;
        if (this.lookahead.type === Token.Identifier) {
            imported = this.parseVariableIdentifier();
            local = imported;
            if (this.matchContextualKeyword('as')) {
                this.nextToken();
                local = this.parseVariableIdentifier();
            }
        }
        else {
            imported = this.parseIdentifierName();
            local = imported;
            if (this.matchContextualKeyword('as')) {
                this.nextToken();
                local = this.parseVariableIdentifier();
            }
            else {
                this.throwUnexpectedToken(this.nextToken());
            }
        }

        return this.finalize(node, new ImportSpecifier(local, imported));
    }

    // {foo, bar as bas}
    parseNamedImports(): ImportSpecifier[] {
        this.expect('{');
        const specifiers: ImportSpecifier[] = [];
        while (!this.match('}')) {
            specifiers.push(this.parseImportSpecifier());
            if (!this.match('}')) {
                this.expect(',');
            }
        }
        this.expect('}');

        return specifiers;
    }

    // import <foo> ...;
    parseImportDefaultSpecifier(): ImportDefaultSpecifier {
        const node = this.createNode();
        const local = this.parseIdentifierName();
        return this.finalize(node, new ImportDefaultSpecifier(local));
    }

    // import <* as foo> ...;
    parseImportNamespaceSpecifier(): ImportNamespaceSpecifier {
        const node = this.createNode();

        this.expect('*');
        if (!this.matchContextualKeyword('as')) {
            this.throwError(Messages.NoAsAfterImportNamespace);
        }
        this.nextToken();
        const local = this.parseIdentifierName();

        return this.finalize(node, new ImportNamespaceSpecifier(local));
    }

    parseImportDeclaration(): ImportDeclaration {
        if (this.context.inFunctionBody) {
            this.throwError(Messages.IllegalImportDeclaration);
        }

        const node = this.createNode();
        this.expectKeyword('import');

        let src: Literal;
        let specifiers: ImportDeclarationSpecifier[] = [];
        if (this.lookahead.type === Token.StringLiteral) {
            // import 'foo';
            src = this.parseModuleSpecifier();
        }
        else {
            if (this.match('{')) {
                // import {bar}
                specifiers = specifiers.concat(this.parseNamedImports());
            }
            else if (this.match('*')) {
                // import * as foo
                specifiers.push(this.parseImportNamespaceSpecifier());
            }
            else if (this.isIdentifierName(this.lookahead) && !this.matchKeyword('default')) {
                // import foo
                specifiers.push(this.parseImportDefaultSpecifier());
                if (this.match(',')) {
                    this.nextToken();
                    if (this.match('*')) {
                        // import foo, * as foo
                        specifiers.push(this.parseImportNamespaceSpecifier());
                    }
                    else if (this.match('{')) {
                        // import foo, {bar}
                        specifiers = specifiers.concat(this.parseNamedImports());
                    }
                    else {
                        this.throwUnexpectedToken(this.lookahead);
                    }
                }
            }
            else {
                this.throwUnexpectedToken(this.nextToken());
            }

            if (!this.matchContextualKeyword('from')) {
                const message = this.lookahead.value ? Messages.UnexpectedToken : Messages.MissingFromClause;
                this.throwError(message, this.lookahead.value);
            }
            this.nextToken();
            src = this.parseModuleSpecifier();
        }
        this.consumeSemicolon();

        return this.finalize(node, new ImportDeclaration(specifiers, src));
    }

    // https://tc39.github.io/ecma262/#sec-exports

    parseExportSpecifier(): ExportSpecifier {
        const node = this.createNode();

        const local = this.parseIdentifierName();
        let exported = local;
        if (this.matchContextualKeyword('as')) {
            this.nextToken();
            exported = this.parseIdentifierName();
        }

        return this.finalize(node, new ExportSpecifier(local, exported));
    }

    parseExportDeclaration(): ExportDeclaration {
        if (this.context.inFunctionBody) {
            this.throwError(Messages.IllegalExportDeclaration);
        }

        const node = this.createNode();
        this.expectKeyword('export');

        if (this.matchKeyword('default')) {
            // export default ...
            this.nextToken();
            if (this.matchKeyword('function')) {
                // export default function foo () {}
                // export default function () {}
                const declaration = this.parseFunctionDeclaration(true);
                return this.finalize(node, new ExportDefaultDeclaration(declaration));
            }
            else if (this.matchKeyword('class')) {
                // export default class foo {}
                const declaration = this.parseClassDeclaration(true);
                return this.finalize(node, new ExportDefaultDeclaration(declaration));
            }
            else if (this.matchContextualKeyword('async')) {
                // export default async function f () {}
                // export default async function () {}
                // export default async x => x
                const declaration = this.matchAsyncFunction() ? this.parseFunctionDeclaration(true) : this.parseAssignmentExpression();
                return this.finalize(node, new ExportDefaultDeclaration(declaration));
            }
            else {
                if (this.matchContextualKeyword('from')) {
                    this.throwError(Messages.UnexpectedToken, this.lookahead.value);
                }
                // export default {};
                // export default [];
                // export default (1 + 2);
                const declaration = this.match('{') ? this.parseObjectInitializer() :
                    this.match('[') ? this.parseArrayInitializer() : this.parseAssignmentExpression();
                this.consumeSemicolon();
                return this.finalize(node, new ExportDefaultDeclaration(declaration));
            }

        }
        else if (this.match('*')) {
            // export * from 'foo';
            this.nextToken();
            if (!this.matchContextualKeyword('from')) {
                const message = this.lookahead.value ? Messages.UnexpectedToken : Messages.MissingFromClause;
                this.throwError(message, this.lookahead.value);
            }
            this.nextToken();
            const src = this.parseModuleSpecifier();
            this.consumeSemicolon();
            return this.finalize(node, new ExportAllDeclaration(src));

        }
        else if (this.lookahead.type === Token.Keyword) {
            // export var f = 1;
            switch (this.lookahead.value) {
                case 'let':
                case 'const': {
                    const declaration = this.parseLexicalDeclaration({ inFor: false });
                    return this.finalize(node, new ExportNamedDeclaration(declaration, [], null));
                }
                case 'var': {
                    const declaration = this.parseVariableStatement();
                    return this.finalize(node, new ExportNamedDeclaration(declaration, [], null));
                }
                case 'class': {
                    const declaration = this.parseClassDeclaration();
                    return this.finalize(node, new ExportNamedDeclaration(declaration, [], null));
                }
                case 'function': {
                    const declaration = this.parseFunctionDeclaration();
                    return this.finalize(node, new ExportNamedDeclaration(declaration, [], null));
                }
                default:
                    this.throwUnexpectedToken(this.lookahead);
            }
        }
        else if (this.matchAsyncFunction()) {
            const declaration = this.parseFunctionDeclaration();
            return this.finalize(node, new ExportNamedDeclaration(declaration, [], null));
        }
        else {
            const specifiers: ExportSpecifier[] = [];
            let source: Literal | null = null;
            let isExportFromIdentifier = false;

            this.expect('{');
            while (!this.match('}')) {
                isExportFromIdentifier = isExportFromIdentifier || this.matchKeyword('default');
                specifiers.push(this.parseExportSpecifier());
                if (!this.match('}')) {
                    this.expect(',');
                }
            }
            this.expect('}');

            if (this.matchContextualKeyword('from')) {
                // export {default} from 'foo';
                // export {foo} from 'foo';
                this.nextToken();
                source = this.parseModuleSpecifier();
                this.consumeSemicolon();
            }
            else if (isExportFromIdentifier) {
                // export {default}; // missing fromClause
                const message = this.lookahead.value ? Messages.UnexpectedToken : Messages.MissingFromClause;
                this.throwError(message, this.lookahead.value);
            }
            else {
                // export {foo};
                this.consumeSemicolon();
            }
            return this.finalize(node, new ExportNamedDeclaration(null, specifiers, source));
        }
    }

}
