import { Character } from './character';
import { ParseDelegate, ParseOptions } from './esprima';
import { JSXAttribute, JSXAttributeName, JSXAttributeValue, JSXChild, JSXClosingElement, JSXClosingFragment, JSXElement, JSXElementAttribute, JSXElementName, JSXEmptyExpression, JSXExpressionContainer, JSXIdentifier, JSXMemberExpression, JSXNamespacedName, JSXOpeningElement, JSXOpeningFragment, JSXSpreadAttribute, JSXText } from './jsx-nodes';
import { JSXSyntax } from './jsx-syntax';
import * as Node from './nodes';
import { Marker, Parser } from './parser';
import { RawToken, Token } from './token';
import { XHTMLEntities } from './xhtml-entities';

interface MetaJSXElement {
    node: Marker;
    opening: JSXOpeningElement | JSXOpeningFragment;
    closing: JSXClosingElement | JSXClosingFragment | null;
    children: JSXChild[];
}

// Fully qualified element name, e.g. <svg:path> returns "svg:path"
function getQualifiedElementName(elementName: JSXElementName): string {

    switch (elementName.type) {
        case JSXSyntax.JSXIdentifier: {
            const id = elementName as JSXIdentifier;
            return id.name;
        }
        case JSXSyntax.JSXNamespacedName: {
            const ns = elementName as JSXNamespacedName;
            return getQualifiedElementName(ns.namespace) + ':' + getQualifiedElementName(ns.name);
        }
        case JSXSyntax.JSXMemberExpression: {
            const expr = elementName as JSXMemberExpression;
            return getQualifiedElementName(expr.object) + '.' + getQualifiedElementName(expr.property);
        }
        /* istanbul ignore next */
        default: {
            throw new Error(`getQualifiedElementName`);
        }
    }
}

export class JSXParser extends Parser {

    constructor(code: string, options: ParseOptions, delegate?: ParseDelegate) {
        super(code, options, delegate);
    }

    parsePrimaryExpression(): Node.Expression | JSXElement {
        return this.match('<') ? this.parseJSXRoot() : super.parsePrimaryExpression();
    }

    startJSX(): void {
        // Unwind the scanner before the lookahead token.
        this.scanner.index = this.startMarker.index;
        this.scanner.lineNumber = this.startMarker.line;
        this.scanner.lineStart = this.startMarker.index - this.startMarker.column;
    }

    finishJSX(): RawToken {
        // Prime the next lookahead.
        return this.nextToken();
    }

    reenterJSX(): void {
        this.startJSX();
        this.expectJSX('}');

        // Pop the closing '}' added from the lookahead.
        if (this.config.tokens) {
            this.tokens.pop();
        }
    }

    createJSXNode(): Marker {
        this.collectComments();
        return {
            index: this.scanner.index,
            line: this.scanner.lineNumber,
            column: this.scanner.index - this.scanner.lineStart
        };
    }

    createJSXChildNode(): Marker {
        return {
            index: this.scanner.index,
            line: this.scanner.lineNumber,
            column: this.scanner.index - this.scanner.lineStart
        };
    }

    scanXHTMLEntity(quote: string): string {
        let result = '&';

        let valid = true;
        let terminated = false;
        let numeric = false;
        let hex = false;

        while (!this.scanner.eof() && valid && !terminated) {
            const ch = this.scanner.source[this.scanner.index];
            if (ch === quote) {
                break;
            }
            terminated = (ch === ';');
            result += ch;
            ++this.scanner.index;
            if (!terminated) {
                switch (result.length) {
                    case 2:
                        // e.g. '&#123;'
                        numeric = (ch === '#');
                        break;
                    case 3:
                        if (numeric) {
                            // e.g. '&#x41;'
                            hex = (ch === 'x');
                            valid = hex || Character.isDecimalDigit(ch.charCodeAt(0));
                            numeric = numeric && !hex;
                        }
                        break;
                    default:
                        valid = valid && !(numeric && !Character.isDecimalDigit(ch.charCodeAt(0)));
                        valid = valid && !(hex && !Character.isHexDigit(ch.charCodeAt(0)));
                        break;
                }
            }
        }

        if (valid && terminated && result.length > 2) {
            // e.g. '&#x41;' becomes just '#x41'
            const str = result.substr(1, result.length - 2);
            if (numeric && str.length > 1) {
                result = String.fromCharCode(parseInt(str.substr(1), 10));
            }
            else if (hex && str.length > 2) {
                result = String.fromCharCode(parseInt('0' + str.substr(1), 16));
            }
            else if (!numeric && !hex && XHTMLEntities[str]) {
                result = XHTMLEntities[str];
            }
        }

        return result;
    }

    // Scan the next JSX token. This replaces Scanner#lex when in JSX mode.

    lexJSX(): RawToken {
        const cp = this.scanner.source.charCodeAt(this.scanner.index);

        // < > / : = { }
        if (cp === 60 || cp === 62 || cp === 47 || cp === 58 || cp === 61 || cp === 123 || cp === 125) {
            const value = this.scanner.source[this.scanner.index++];
            return {
                type: Token.Punctuator,
                value: value,
                lineNumber: this.scanner.lineNumber,
                lineStart: this.scanner.lineStart,
                start: this.scanner.index - 1,
                end: this.scanner.index
            };
        }

        // " '
        if (cp === 34 || cp === 39) {
            const start = this.scanner.index;
            const quote = this.scanner.source[this.scanner.index++];
            let str = '';
            while (!this.scanner.eof()) {
                const ch = this.scanner.source[this.scanner.index++];
                if (ch === quote) {
                    break;
                }
                else if (ch === '&') {
                    str += this.scanXHTMLEntity(quote);
                }
                else {
                    str += ch;
                }
            }

            return {
                type: Token.StringLiteral,
                value: str,
                lineNumber: this.scanner.lineNumber,
                lineStart: this.scanner.lineStart,
                start: start,
                end: this.scanner.index
            };
        }

        // ... or .
        if (cp === 46) {
            const n1 = this.scanner.source.charCodeAt(this.scanner.index + 1);
            const n2 = this.scanner.source.charCodeAt(this.scanner.index + 2);
            const value = (n1 === 46 && n2 === 46) ? '...' : '.';
            const start = this.scanner.index;
            this.scanner.index += value.length;
            return {
                type: Token.Punctuator,
                value: value,
                lineNumber: this.scanner.lineNumber,
                lineStart: this.scanner.lineStart,
                start: start,
                end: this.scanner.index
            };
        }

        // `
        if (cp === 96) {
            // Only placeholder, since it will be rescanned as a real assignment expression.
            return {
                type: Token.Template,
                value: '',
                lineNumber: this.scanner.lineNumber,
                lineStart: this.scanner.lineStart,
                start: this.scanner.index,
                end: this.scanner.index
            };
        }

        // Identifer can not contain backslash (char code 92).
        if (Character.isIdentifierStart(cp) && (cp !== 92)) {
            const start = this.scanner.index;
            ++this.scanner.index;
            while (!this.scanner.eof()) {
                const ch = this.scanner.source.charCodeAt(this.scanner.index);
                if (Character.isIdentifierPart(ch) && (ch !== 92)) {
                    ++this.scanner.index;
                }
                else if (ch === 45) {
                    // Hyphen (char code 45) can be part of an identifier.
                    ++this.scanner.index;
                }
                else {
                    break;
                }
            }
            const id = this.scanner.source.slice(start, this.scanner.index);
            return {
                type: Token.JSXIdentifier,
                value: id,
                lineNumber: this.scanner.lineNumber,
                lineStart: this.scanner.lineStart,
                start: start,
                end: this.scanner.index
            };
        }

        return this.scanner.lex();
    }

    nextJSXToken(): RawToken {
        this.collectComments();

        this.startMarker.index = this.scanner.index;
        this.startMarker.line = this.scanner.lineNumber;
        this.startMarker.column = this.scanner.index - this.scanner.lineStart;
        const token = this.lexJSX();
        this.lastMarker.index = this.scanner.index;
        this.lastMarker.line = this.scanner.lineNumber;
        this.lastMarker.column = this.scanner.index - this.scanner.lineStart;

        if (this.config.tokens) {
            this.tokens.push(this.convertToken(token));
        }

        return token;
    }

    nextJSXText(): RawToken {
        this.startMarker.index = this.scanner.index;
        this.startMarker.line = this.scanner.lineNumber;
        this.startMarker.column = this.scanner.index - this.scanner.lineStart;

        const start = this.scanner.index;

        let text = '';
        while (!this.scanner.eof()) {
            const ch = this.scanner.source[this.scanner.index];
            if (ch === '{' || ch === '<') {
                break;
            }
            ++this.scanner.index;
            text += ch;
            if (Character.isLineTerminator(ch.charCodeAt(0))) {
                ++this.scanner.lineNumber;
                if (ch === '\r' && this.scanner.source[this.scanner.index] === '\n') {
                    ++this.scanner.index;
                }
                this.scanner.lineStart = this.scanner.index;
            }
        }

        this.lastMarker.index = this.scanner.index;
        this.lastMarker.line = this.scanner.lineNumber;
        this.lastMarker.column = this.scanner.index - this.scanner.lineStart;

        const token = {
            type: Token.JSXText,
            value: text,
            lineNumber: this.scanner.lineNumber,
            lineStart: this.scanner.lineStart,
            start: start,
            end: this.scanner.index
        };

        if ((text.length > 0) && this.config.tokens) {
            this.tokens.push(this.convertToken(token));
        }

        return token;
    }

    peekJSXToken(): RawToken {
        const state = this.scanner.saveState();
        this.scanner.scanComments();
        const next = this.lexJSX();
        this.scanner.restoreState(state);

        return next;
    }

    // Expect the next JSX token to match the specified punctuator.
    // If not, an exception will be thrown.

    expectJSX(value: string): void {
        const token = this.nextJSXToken();
        if (token.type !== Token.Punctuator || token.value !== value) {
            this.throwUnexpectedToken(token);
        }
    }

    // Return true if the next JSX token matches the specified punctuator.

    matchJSX(value: string): boolean {
        const next = this.peekJSXToken();
        return next.type === Token.Punctuator && next.value === value;
    }

    parseJSXIdentifier(): JSXIdentifier {
        const node = this.createJSXNode();
        const token = this.nextJSXToken();
        if (token.type !== Token.JSXIdentifier) {
            this.throwUnexpectedToken(token);
        }
        return this.finalize(node, new JSXIdentifier(token.value as string));
    }

    parseJSXElementName(): JSXElementName {
        const node = this.createJSXNode();
        const elementName: JSXIdentifier = this.parseJSXIdentifier();

        if (this.matchJSX(':')) {
            const namespace = elementName;
            this.expectJSX(':');
            const name = this.parseJSXIdentifier();
            return this.finalize(node, new JSXNamespacedName(namespace, name));
        }
        else if (this.matchJSX('.')) {
            let retval: JSXIdentifier | JSXMemberExpression = elementName;
            while (this.matchJSX('.')) {
                this.expectJSX('.');
                const property = this.parseJSXIdentifier();
                retval = this.finalize(node, new JSXMemberExpression(retval, property));
            }
            return retval;
        }
        else {
            return elementName;
        }
    }

    parseJSXAttributeName(): JSXAttributeName {
        const node = this.createJSXNode();
        let attributeName: JSXAttributeName;

        const identifier = this.parseJSXIdentifier();
        if (this.matchJSX(':')) {
            const namespace = identifier;
            this.expectJSX(':');
            const name = this.parseJSXIdentifier();
            attributeName = this.finalize(node, new JSXNamespacedName(namespace, name));
        }
        else {
            attributeName = identifier;
        }

        return attributeName;
    }

    parseJSXStringLiteralAttribute(): Node.Literal {
        const node = this.createJSXNode();
        const token = this.nextJSXToken();
        if (token.type !== Token.StringLiteral) {
            this.throwUnexpectedToken(token);
        }
        const raw = this.getTokenRaw(token);
        return this.finalize(node, new Node.Literal(token.value, raw));
    }

    parseJSXExpressionAttribute(): JSXExpressionContainer {
        const node = this.createJSXNode();

        this.expectJSX('{');
        this.finishJSX();

        if (this.match('}')) {
            this.tolerateError('JSX attributes must only be assigned a non-empty expression');
        }

        const expression = this.parseAssignmentExpression();
        this.reenterJSX();

        return this.finalize(node, new JSXExpressionContainer(expression));
    }

    parseJSXAttributeValue(): JSXAttributeValue {
        return this.matchJSX('{') ? this.parseJSXExpressionAttribute() :
            this.matchJSX('<') ? this.parseJSXElement() : this.parseJSXStringLiteralAttribute();
    }

    parseJSXNameValueAttribute(): JSXAttribute {
        const node = this.createJSXNode();
        const name = this.parseJSXAttributeName();
        let value: JSXAttributeValue | null = null;
        if (this.matchJSX('=')) {
            this.expectJSX('=');
            value = this.parseJSXAttributeValue();
        }
        return this.finalize(node, new JSXAttribute(name, value));
    }

    parseJSXSpreadAttribute(): JSXSpreadAttribute {
        const node = this.createJSXNode();
        this.expectJSX('{');
        this.expectJSX('...');

        this.finishJSX();
        const argument = this.parseAssignmentExpression();
        this.reenterJSX();

        return this.finalize(node, new JSXSpreadAttribute(argument));
    }

    parseJSXAttributes(): JSXElementAttribute[] {
        const attributes: JSXElementAttribute[] = [];

        while (!this.matchJSX('/') && !this.matchJSX('>')) {
            const attribute = this.matchJSX('{') ? this.parseJSXSpreadAttribute() :
                this.parseJSXNameValueAttribute();
            attributes.push(attribute);
        }

        return attributes;
    }

    parseJSXOpeningElement(): JSXOpeningElement | JSXOpeningFragment {
        const node = this.createJSXNode();

        this.expectJSX('<');
        if (this.matchJSX('>')) {
            this.expectJSX('>');
            return this.finalize(node, new JSXOpeningFragment(false));
        }

        const name = this.parseJSXElementName();
        const attributes = this.parseJSXAttributes();
        const selfClosing = this.matchJSX('/');
        if (selfClosing) {
            this.expectJSX('/');
        }
        this.expectJSX('>');

        return this.finalize(node, new JSXOpeningElement(name, selfClosing, attributes));
    }

    parseJSXBoundaryElement(): JSXOpeningElement | JSXClosingElement | JSXOpeningFragment | JSXClosingFragment {
        const node = this.createJSXNode();

        this.expectJSX('<');
        if (this.matchJSX('/')) {
            this.expectJSX('/');
            if (this.matchJSX('>')) {
                this.expectJSX('>');
                return this.finalize(node, new JSXClosingFragment());
            }
            const elementName = this.parseJSXElementName();
            this.expectJSX('>');
            return this.finalize(node, new JSXClosingElement(elementName));
        }

        const name = this.parseJSXElementName();
        const attributes = this.parseJSXAttributes();
        const selfClosing = this.matchJSX('/');
        if (selfClosing) {
            this.expectJSX('/');
        }
        this.expectJSX('>');

        return this.finalize(node, new JSXOpeningElement(name, selfClosing, attributes));
    }

    parseJSXEmptyExpression(): JSXEmptyExpression {
        const node = this.createJSXChildNode();
        this.collectComments();
        this.lastMarker.index = this.scanner.index;
        this.lastMarker.line = this.scanner.lineNumber;
        this.lastMarker.column = this.scanner.index - this.scanner.lineStart;
        return this.finalize(node, new JSXEmptyExpression());
    }

    parseJSXExpressionContainer(): JSXExpressionContainer {
        const node = this.createJSXNode();
        this.expectJSX('{');

        let expression: Node.Expression | JSXEmptyExpression;
        if (this.matchJSX('}')) {
            expression = this.parseJSXEmptyExpression();
            this.expectJSX('}');
        }
        else {
            this.finishJSX();
            expression = this.parseAssignmentExpression();
            this.reenterJSX();
        }

        return this.finalize(node, new JSXExpressionContainer(expression));
    }

    parseJSXChildren(): JSXChild[] {
        const children: JSXChild[] = [];

        while (!this.scanner.eof()) {
            const node = this.createJSXChildNode();
            const token = this.nextJSXText();
            if (token.start < token.end) {
                const raw = this.getTokenRaw(token);
                const child = this.finalize(node, new JSXText(token.value as string, raw));
                children.push(child);
            }
            if (this.scanner.source[this.scanner.index] === '{') {
                const container = this.parseJSXExpressionContainer();
                children.push(container);
            }
            else {
                break;
            }
        }

        return children;
    }

    parseComplexJSXElement(el: MetaJSXElement): MetaJSXElement {
        const stack: MetaJSXElement[] = [];

        while (!this.scanner.eof()) {
            el.children = el.children.concat(this.parseJSXChildren());
            const node = this.createJSXChildNode();
            const element = this.parseJSXBoundaryElement();
            if (element.type === JSXSyntax.JSXOpeningElement) {
                const opening = element as JSXOpeningElement;
                if (opening.selfClosing) {
                    const child = this.finalize(node, new JSXElement(opening, [], null));
                    el.children.push(child);
                }
                else {
                    stack.push(el);
                    el = { node, opening, closing: null, children: [] };
                }
            }
            if (element.type === JSXSyntax.JSXClosingElement) {
                el.closing = element as JSXClosingElement;
                const open = getQualifiedElementName((el.opening as JSXOpeningElement).name);
                const close = getQualifiedElementName((el.closing as JSXClosingElement).name);
                if (open !== close) {
                    this.tolerateError('Expected corresponding JSX closing tag for %0', open);
                }
                if (stack.length > 0) {
                    const child = this.finalize(el.node, new JSXElement(el.opening, el.children, el.closing));
                    el = stack[stack.length - 1];
                    el.children.push(child);
                    stack.pop();
                }
                else {
                    break;
                }
            }
            if (element.type === JSXSyntax.JSXClosingFragment) {
                el.closing = element as JSXClosingFragment;
                if (el.opening.type !== JSXSyntax.JSXOpeningFragment) {
                    this.tolerateError('Expected corresponding JSX closing tag for jsx fragment');
                }
                else {
                    break;
                }
            }
        }

        return el;
    }

    parseJSXElement(): JSXElement {
        const node = this.createJSXNode();

        const opening = this.parseJSXOpeningElement();
        let children: JSXChild[] = [];
        let closing: JSXClosingElement | JSXClosingFragment | null = null;

        if (!opening.selfClosing) {
            const el = this.parseComplexJSXElement({ node, opening, closing, children });
            children = el.children;
            closing = el.closing;
        }

        return this.finalize(node, new JSXElement(opening, children, closing));
    }

    parseJSXRoot(): JSXElement {
        // Pop the opening '<' added from the lookahead.
        if (this.config.tokens) {
            this.tokens.pop();
        }

        this.startJSX();
        const element = this.parseJSXElement();
        this.finishJSX();

        return element;
    }

    isStartOfExpression(): boolean {
        return super.isStartOfExpression() || this.match('<');
    }

}
