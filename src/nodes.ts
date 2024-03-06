import { assert } from './assert';
import { Comment, Node } from './node';
import { SourceLocation } from './scanner';
import { Syntax } from './syntax';
import { TokenEntry } from './token';

export type ArgumentListElement = Expression | SpreadElement;
export type ArrayExpressionElement = Expression | SpreadElement | null;
export type ArrayPatternElement = AssignmentPattern | BindingIdentifier | BindingPattern | RestElement | null;
export type BindingPattern = ArrayPattern | ObjectPattern;
export type BindingIdentifier = Identifier;
export type ChainElement = CallExpression | MemberExpression;
export type Declaration = AsyncFunctionDeclaration | ClassDeclaration | ExportDeclaration | FunctionDeclaration | ImportDeclaration | VariableDeclaration;
export type ExportableDefaultDeclaration = BindingIdentifier | BindingPattern | ClassDeclaration | Expression | FunctionDeclaration;
export type ExportableNamedDeclaration = AsyncFunctionDeclaration | ClassDeclaration | FunctionDeclaration | VariableDeclaration;
export type ExportDeclaration = ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration;
export type Expression = ArrayExpression | ArrowFunctionExpression | AssignmentExpression | AsyncArrowFunctionExpression |
    AwaitExpression | BinaryExpression | CallExpression | ChainExpression | ClassExpression | ConditionalExpression |
    Identifier | FunctionExpression | Literal | MemberExpression | NewExpression | ObjectExpression |
    RegexLiteral | SequenceExpression | TaggedTemplateExpression |
    ThisExpression | UnaryExpression | UpdateExpression | YieldExpression;

export type FunctionParameter = AssignmentPattern | BindingIdentifier | BindingPattern;

export function is_function_parameter(node: Node): node is FunctionParameter {
    return is_array_pattern(node) || is_assignment_pattern(node) || is_identifier(node) || is_object_expression(node) || is_object_pattern(node) || is_rest_element(node) || is_spread_element(node);
}

export function assert_function_parameter(node: Node): FunctionParameter {
    if (is_function_parameter(node)) {
        return node;
    }
    else {
        throw new Error(`assert_function_parameter ${node.type}`);
    }
}

export function is_function_parameters(nodes: Node[]): nodes is FunctionParameter[] {
    return nodes.every(is_function_parameter);
}

export function assert_function_parameters(nodes: Node[]): FunctionParameter[] {
    if (is_function_parameters(nodes)) {
        return nodes;
    }
    else {
        return nodes.map(x => assert_function_parameter(x));
    }
}

export type ImportDeclarationSpecifier = ImportDefaultSpecifier | ImportNamespaceSpecifier | ImportSpecifier;
export type ObjectExpressionProperty = Property | SpreadElement;
export type ObjectPatternProperty = Property | RestElement;
export type Program = Module | Script;
export type Statement = AsyncFunctionDeclaration | BreakStatement | ContinueStatement | DebuggerStatement | DoWhileStatement |
    EmptyStatement | ExpressionStatement | Directive | ForStatement | ForInStatement | ForOfStatement |
    FunctionDeclaration | IfStatement | ReturnStatement | SwitchStatement | ThrowStatement |
    TryStatement | VariableDeclaration | WhileStatement | WithStatement;
/**
 * WARNING: Collision with lib.es5.d.ts symbol.
 */
export type PropertyKey = Identifier | Literal;
export type PropertyValue = AssignmentPattern | BindingIdentifier | BindingPattern | FunctionExpression;
export type StatementListItem = Declaration | Statement;

export abstract class BaseNode implements Node {
    leadingComments?: Comment[];
    trailingComments?: Comment[];
    innerComments?: Comment[];
    range?: [number, number];
    loc?: SourceLocation;
    constructor(readonly type: string) {
    }
}

export class ArrayExpression extends BaseNode {
    readonly elements: ArrayExpressionElement[];
    constructor(elements: ArrayExpressionElement[]) {
        super(Syntax.ArrayExpression);
        this.elements = elements;
        assert(is_array_expression(this), this.type);
    }
}

export function is_array_expression(node: Node): node is ArrayExpression {
    return node.type === Syntax.ArrayExpression;
}

export class ArrayPattern extends BaseNode {
    readonly elements: ArrayPatternElement[];
    constructor(elements: ArrayPatternElement[]) {
        super(Syntax.ArrayPattern);
        this.elements = elements;
        assert(is_array_pattern(this), this.type);
    }
}

export function is_array_pattern(node: Node): node is ArrayPattern {
    return node.type === Syntax.ArrayPattern;
}

export class ArrowFunctionExpression extends BaseNode {
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement | Expression;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(params: FunctionParameter[], body: BlockStatement | Expression, expression: boolean) {
        super(Syntax.ArrowFunctionExpression);
        this.id = null;
        this.params = params;
        this.body = body;
        this.generator = false;
        this.expression = expression;
        this.async = false;
        assert(is_arrow_function_expression(this), this.type);
    }
}

export function is_arrow_function_expression(node: Node): node is ArrowFunctionExpression {
    return node.type === Syntax.ArrowFunctionExpression;
}

export class ArrowParameterPlaceHolder extends BaseNode {
    readonly params: Expression[];
    readonly async: boolean;
    constructor(params: Expression[], async: boolean) {
        super(Syntax.ArrowParameterPlaceHolder);
        this.params = params;
        this.async = async;
        assert(is_arrow_parameter_placeholder(this), this.type);
    }
}

export function is_arrow_parameter_placeholder(node: Node): node is ArrowParameterPlaceHolder {
    return node.type === Syntax.ArrowParameterPlaceHolder;
}

export class AssignmentExpression extends BaseNode {
    readonly operator: string;
    readonly left: Expression;
    readonly right: Expression;
    constructor(operator: string, left: Expression, right: Expression) {
        super(Syntax.AssignmentExpression);
        this.operator = operator;
        this.left = left;
        this.right = right;
        assert(is_assignment_expression(this), this.type);
    }
}

export function is_assignment_expression(node: Node): node is AssignmentExpression {
    return node.type === Syntax.AssignmentExpression;
}

export class AssignmentPattern extends BaseNode {
    readonly left: BindingIdentifier | BindingPattern;
    readonly right: Expression;
    constructor(left: BindingIdentifier | BindingPattern, right: Expression) {
        super(Syntax.AssignmentPattern);
        this.left = left;
        this.right = right;
        assert(is_assignment_pattern(this), this.type);
    }
}

export function is_assignment_pattern(node: Node): node is AssignmentPattern {
    return node.type === Syntax.AssignmentPattern;
}

export class AsyncArrowFunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement | Expression;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(params: FunctionParameter[], body: BlockStatement | Expression, expression: boolean) {
        this.type = Syntax.ArrowFunctionExpression;
        this.id = null;
        this.params = params;
        this.body = body;
        this.generator = false;
        this.expression = expression;
        this.async = true;
    }
}

export class AsyncFunctionDeclaration {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(id: Identifier | null, params: FunctionParameter[], body: BlockStatement, generator: boolean) {
        this.type = Syntax.FunctionDeclaration;
        this.id = id;
        this.params = params;
        this.body = body;
        this.generator = generator;
        this.expression = false;
        this.async = true;
    }
}

export class AwaitExpression {
    readonly type: string;
    readonly argument: Expression;
    constructor(argument: Expression) {
        this.type = Syntax.AwaitExpression;
        this.argument = argument;
    }
}

export type LogicalOperator = '||' | '&&' | '??';
export type BinaryOperator = '+' | '-' | '*' | '/' | '|' | '^' | '**' | '===' | '!==' | '==' | '!=' | '&' | '<' | '>' | '<=' | '>=' | '<<' | '>>' | '>>>' | '%' | 'in' | 'instanceof' | LogicalOperator;

function is_logical_operator(operator: BinaryOperator): operator is LogicalOperator {
    return operator === '||' || operator === '&&' || operator === '??';
}

function binary_expression_type(operator: BinaryOperator): string {
    return is_logical_operator(operator) ? Syntax.LogicalExpression : Syntax.BinaryExpression;
}

export class BinaryExpression extends BaseNode {
    readonly operator: BinaryOperator;
    readonly left: Expression;
    readonly right: Expression;
    constructor(operator: BinaryOperator, left: Expression, right: Expression) {
        super(binary_expression_type(operator));
        this.operator = operator;
        this.left = left;
        this.right = right;
        assert(is_binary_expression(this), this.type);
    }
}

export function is_binary_expression(node: Node): node is BinaryExpression {
    return (node.type === Syntax.BinaryExpression) || (node.type === Syntax.LogicalExpression);
}

export class BlockStatement extends BaseNode {
    readonly body: Statement[];
    constructor(body: Statement[]) {
        super(Syntax.BlockStatement);
        this.body = body;
        assert(is_block_statement(this), this.type);
    }
}

export function is_block_statement(node: Node): node is BlockStatement {
    return node.type === Syntax.BlockStatement;
}

export class BreakStatement extends BaseNode {
    readonly label: Identifier | null;
    constructor(label: Identifier | null) {
        super(Syntax.BreakStatement);
        this.label = label;
        assert(is_break_statement(this), this.type);
    }
}

export function is_break_statement(node: Node): node is BreakStatement {
    return node.type === Syntax.BreakStatement;
}

export class CallExpression extends BaseNode {
    readonly callee: Expression | Import;
    readonly arguments: ArgumentListElement[];
    readonly optional: boolean;
    constructor(callee: Expression | Import, args: ArgumentListElement[], optional: boolean) {
        super(Syntax.CallExpression);
        this.callee = callee;
        this.arguments = args;
        this.optional = optional;
        assert(is_call_expression(this), this.type);
    }
}

export function is_call_expression(node: Node): node is CallExpression {
    return node.type === Syntax.CallExpression;
}

export class CatchClause {
    readonly type: string;
    readonly param: BindingIdentifier | BindingPattern | null;
    readonly body: BlockStatement;
    constructor(param: BindingIdentifier | BindingPattern | null, body: BlockStatement) {
        this.type = Syntax.CatchClause;
        this.param = param;
        this.body = body;
    }
}

export class ChainExpression {
    readonly type: string;
    readonly expression: ChainElement;
    constructor(expression: ChainElement) {
        this.type = Syntax.ChainExpression;
        this.expression = expression;
    }
}

export class ClassBody {
    readonly type: string;
    readonly body: (Property | MethodDefinition)[];
    constructor(body: (Property | MethodDefinition)[]) {
        this.type = Syntax.ClassBody;
        this.body = body;
    }
}

export class ClassDeclaration {
    readonly type: string;
    readonly id: Identifier | null;
    readonly superClass: Identifier | null;
    readonly body: ClassBody;
    constructor(id: Identifier | null, superClass: Identifier | null, body: ClassBody) {
        this.type = Syntax.ClassDeclaration;
        this.id = id;
        this.superClass = superClass;
        this.body = body;
    }
}

export class ClassExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly superClass: Identifier | null;
    readonly body: ClassBody;
    constructor(id: Identifier | null, superClass: Identifier | null, body: ClassBody) {
        this.type = Syntax.ClassExpression;
        this.id = id;
        this.superClass = superClass;
        this.body = body;
    }
}

export class ConditionalExpression {
    readonly type: string;
    readonly test: Expression;
    readonly consequent: Expression;
    readonly alternate: Expression;
    constructor(test: Expression, consequent: Expression, alternate: Expression) {
        this.type = Syntax.ConditionalExpression;
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}

export class ContinueStatement {
    readonly type: string;
    readonly label: Identifier | null;
    constructor(label: Identifier | null) {
        this.type = Syntax.ContinueStatement;
        this.label = label;
    }
}

export class DebuggerStatement {
    readonly type: string;
    constructor() {
        this.type = Syntax.DebuggerStatement;
    }
}

export class Directive {
    readonly type: string;
    readonly expression: Expression;
    readonly directive: string;
    constructor(expression: Expression, directive: string) {
        this.type = Syntax.ExpressionStatement;
        this.expression = expression;
        this.directive = directive;
    }
}

export class DoWhileStatement {
    readonly type: string;
    readonly body: Statement;
    readonly test: Expression;
    constructor(body: Statement, test: Expression) {
        this.type = Syntax.DoWhileStatement;
        this.body = body;
        this.test = test;
    }
}

export class EmptyStatement {
    readonly type: string;
    constructor() {
        this.type = Syntax.EmptyStatement;
    }
}

export class ExportAllDeclaration {
    readonly type: string;
    readonly source: Literal;
    constructor(source: Literal) {
        this.type = Syntax.ExportAllDeclaration;
        this.source = source;
    }
}

export class ExportDefaultDeclaration {
    readonly type: string;
    readonly declaration: ExportableDefaultDeclaration;
    constructor(declaration: ExportableDefaultDeclaration) {
        this.type = Syntax.ExportDefaultDeclaration;
        this.declaration = declaration;
    }
}

export class ExportNamedDeclaration {
    readonly type: string;
    readonly declaration: ExportableNamedDeclaration | null;
    readonly specifiers: ExportSpecifier[];
    readonly source: Literal | null;
    constructor(declaration: ExportableNamedDeclaration | null, specifiers: ExportSpecifier[], source: Literal | null) {
        this.type = Syntax.ExportNamedDeclaration;
        this.declaration = declaration;
        this.specifiers = specifiers;
        this.source = source;
    }
}

export class ExportSpecifier {
    readonly type: string;
    readonly exported: Identifier;
    readonly local: Identifier;
    constructor(local: Identifier, exported: Identifier) {
        this.type = Syntax.ExportSpecifier;
        this.exported = exported;
        this.local = local;
    }
}

export class ExpressionStatement extends BaseNode {
    readonly expression: Expression;
    constructor(expression: Expression) {
        super(Syntax.ExpressionStatement);
        this.expression = expression;
        assert(is_expression_statement(this), this.type);
    }
}

export function is_expression_statement(node: Node): node is Directive | ExpressionStatement {
    return node.type === Syntax.ExpressionStatement;
}

export class ForInStatement {
    readonly type: string;
    readonly left: Expression;
    readonly right: Expression;
    readonly body: Statement;
    readonly each: boolean;
    constructor(left: Expression, right: Expression, body: Statement) {
        this.type = Syntax.ForInStatement;
        this.left = left;
        this.right = right;
        this.body = body;
        this.each = false;
    }
}

export class ForOfStatement {
    readonly type: string;
    readonly await: boolean;
    readonly left: Expression;
    readonly right: Expression;
    readonly body: Statement;
    constructor(left: Expression, right: Expression, body: Statement, _await: boolean) {
        this.type = Syntax.ForOfStatement;
        this.await = _await;
        this.left = left;
        this.right = right;
        this.body = body;
    }
}

export class ForStatement {
    readonly type: string;
    readonly init: Expression | null;
    readonly test: Expression | null;
    readonly update: Expression | null;
    body: Statement;
    constructor(init: Expression | null, test: Expression | null, update: Expression | null, body: Statement) {
        this.type = Syntax.ForStatement;
        this.init = init;
        this.test = test;
        this.update = update;
        this.body = body;
    }
}

export class FunctionDeclaration extends BaseNode {
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(id: Identifier | null, params: FunctionParameter[], body: BlockStatement, generator: boolean) {
        super(Syntax.FunctionDeclaration);
        this.id = id;
        this.params = params;
        this.body = body;
        this.generator = generator;
        this.expression = false;
        this.async = false;
        assert(is_function_declaration(this), this.type);
    }
}

export function is_function_declaration(node: Node): node is FunctionDeclaration {
    return node.type === Syntax.FunctionDeclaration;
}

export class FunctionExpression extends BaseNode {
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(id: Identifier | null, params: FunctionParameter[], body: BlockStatement, isGenerator: boolean, isAsync: boolean) {
        super(Syntax.FunctionExpression);
        this.id = id;
        this.params = params;
        this.body = body;
        this.generator = isGenerator;
        this.expression = false;
        this.async = isAsync;
        assert(is_function_expression(this), this.type);
    }
}

export function is_function_expression(node: Node): node is FunctionExpression {
    return node.type === Syntax.FunctionExpression;
}

export class Identifier extends BaseNode {
    readonly name: string;
    constructor(name: string) {
        super(Syntax.Identifier);
        this.name = name;
        assert(is_identifier(this), this.type);
    }
}

export function is_identifier(node: Node): node is Identifier {
    return node.type === Syntax.Identifier;
}

export class IfStatement {
    readonly type: string;
    readonly test: Expression;
    readonly consequent: Statement;
    readonly alternate: Statement | null;
    constructor(test: Expression, consequent: Statement, alternate: Statement | null) {
        this.type = Syntax.IfStatement;
        this.test = test;
        this.consequent = consequent;
        this.alternate = alternate;
    }
}

export class Import {
    readonly type: string;
    constructor() {
        this.type = Syntax.Import;
    }
}

export class ImportDeclaration {
    readonly type: string;
    readonly specifiers: ImportDeclarationSpecifier[];
    readonly source: Literal;
    constructor(specifiers: ImportDeclarationSpecifier[], source: Literal) {
        this.type = Syntax.ImportDeclaration;
        this.specifiers = specifiers;
        this.source = source;
    }
}

export class ImportDefaultSpecifier {
    readonly type: string;
    readonly local: Identifier;
    constructor(local: Identifier) {
        this.type = Syntax.ImportDefaultSpecifier;
        this.local = local;
    }
}

export class ImportNamespaceSpecifier {
    readonly type: string;
    readonly local: Identifier;
    constructor(local: Identifier) {
        this.type = Syntax.ImportNamespaceSpecifier;
        this.local = local;
    }
}

export class ImportSpecifier {
    readonly type: string;
    readonly local: Identifier;
    readonly imported: Identifier;
    constructor(local: Identifier, imported: Identifier) {
        this.type = Syntax.ImportSpecifier;
        this.local = local;
        this.imported = imported;
    }
}

export class LabeledStatement extends BaseNode {
    readonly label: Identifier;
    readonly body: Statement;
    constructor(label: Identifier, body: Statement) {
        super(Syntax.LabeledStatement);
        this.label = label;
        this.body = body;
        assert(is_labeled_statement(this), this.type);
    }
}

export function is_labeled_statement(node: Node): node is LabeledStatement {
    return node.type === Syntax.LabeledStatement;
}

export class Literal extends BaseNode {
    readonly value: boolean | number | string | null;
    readonly raw: string;
    constructor(value: boolean | number | string | null, raw: string) {
        super(Syntax.Literal);
        this.value = value;
        this.raw = raw;
        assert(is_literal(this), this.type);
    }
}

export function is_literal(node: Node): node is Literal {
    return node.type === Syntax.Literal;
}

export class MemberExpression extends BaseNode {
    readonly computed: boolean;
    readonly object: Expression;
    readonly property: Expression;
    readonly optional: boolean;
    constructor(object: Expression, property: Expression, optional: boolean, computed: boolean) {
        super(Syntax.MemberExpression);
        this.computed = computed;
        this.object = object;
        this.property = property;
        this.optional = optional;
        assert(is_member_expression(this), this.type);
    }
}

export function is_member_expression(node: Node): node is MemberExpression {
    return node.type === Syntax.MemberExpression;
}

export class MetaProperty {
    readonly type: string;
    readonly meta: Identifier;
    readonly property: Identifier;
    constructor(meta: Identifier, property: Identifier) {
        this.type = Syntax.MetaProperty;
        this.meta = meta;
        this.property = property;
    }
}

export class MethodDefinition extends BaseNode {
    readonly key: Expression | null;
    readonly computed: boolean;
    readonly value: FunctionExpression | null;
    readonly kind: string;
    readonly static: boolean;
    constructor(key: Expression | null, computed: boolean, value: FunctionExpression | null, kind: string, isStatic: boolean) {
        super(Syntax.MethodDefinition);
        this.key = key;
        this.computed = computed;
        this.value = value;
        this.kind = kind;
        this.static = isStatic;
        assert(is_method_definition(this), this.type);
    }
}

export function is_method_definition(node: Node): node is MethodDefinition {
    return node.type === Syntax.MethodDefinition;
}

export class Module extends BaseNode {
    readonly body: StatementListItem[];
    readonly sourceType: 'module';
    comments?: Comment[];
    tokens?: TokenEntry[];
    errors?: Error[];
    constructor(body: StatementListItem[]) {
        super(Syntax.Program);
        this.body = body;
        this.sourceType = 'module';
        assert(is_module(this), this.type);
    }
}

export function is_module(node: Node): node is Module {
    if (is_program(node)) {
        return node.sourceType === 'module';
    }
    else {
        return false;
    }
}

export class NewExpression {
    readonly type: string;
    readonly callee: Expression;
    readonly arguments: ArgumentListElement[];
    constructor(callee: Expression, args: ArgumentListElement[]) {
        this.type = Syntax.NewExpression;
        this.callee = callee;
        this.arguments = args;
    }
}

export class ObjectExpression extends BaseNode {
    readonly properties: ObjectExpressionProperty[];
    constructor(properties: ObjectExpressionProperty[]) {
        super(Syntax.ObjectExpression);
        this.properties = properties;
        assert(is_object_expression(this), this.type);
    }
}

export function is_object_expression(node: Node): node is ObjectExpression {
    return node.type === Syntax.ObjectExpression;
}

export class ObjectPattern extends BaseNode {
    readonly properties: ObjectPatternProperty[];
    constructor(properties: ObjectPatternProperty[]) {
        super(Syntax.ObjectPattern);
        this.properties = properties;
        assert(is_object_pattern(this), this.type);
    }
}

export function is_object_pattern(node: Node): node is ObjectPattern {
    return node.type === Syntax.ObjectPattern;
}

export class Property extends BaseNode {
    readonly key: PropertyKey;
    readonly computed: boolean;
    readonly value: PropertyValue | null;
    readonly kind: 'get' | 'set' | 'init';
    readonly method: boolean;
    readonly shorthand: boolean;
    constructor(kind: 'get' | 'set' | 'init', key: PropertyKey, computed: boolean, value: PropertyValue | null, method: boolean, shorthand: boolean) {
        super(Syntax.Property);
        this.key = key;
        this.computed = computed;
        this.value = value;
        this.kind = kind;
        this.method = method;
        this.shorthand = shorthand;
        assert(is_property(this), this.type);
    }
}

export function is_property(node: Node): node is Property {
    return node.type === Syntax.Property;
}

export class RegexLiteral {
    readonly type: string;
    readonly value: RegExp;
    readonly raw: string;
    readonly regex: { pattern: string; flags: string | undefined };
    constructor(value: RegExp, raw: string, pattern: string, flags: string | undefined) {
        this.type = Syntax.Literal;
        this.value = value;
        this.raw = raw;
        this.regex = { pattern, flags };
    }
}

export type RestElementArgument = ArrayPattern | AssignmentPattern | MemberExpression | Identifier | ObjectPattern;

export class RestElement extends BaseNode {
    readonly argument: RestElementArgument;
    constructor(argument: RestElementArgument) {
        super(Syntax.RestElement);
        this.argument = argument;
        assert(is_rest_element(this), this.type);
    }
}

export function is_rest_element(node: Node): node is RestElement {
    return node.type === Syntax.RestElement;
}

export function is_rest_element_argument(node: Node): node is RestElementArgument {
    return is_array_pattern(node) || is_assignment_pattern(node) || is_identifier(node) || is_member_expression(node) || is_object_pattern(node);
}

export function assert_rest_element_argument(node: Node): RestElementArgument {
    if (is_rest_element_argument(node)) {
        return node;
    }
    else {
        throw new Error(`assert_rest_element_argument ${node.type}`);
    }
}

export class ReturnStatement extends BaseNode {
    readonly argument: Expression | null;
    constructor(argument: Expression | null) {
        super(Syntax.ReturnStatement);
        this.argument = argument;
        assert(is_return_statement(this), this.type);
    }
}

export function is_return_statement(node: Node): node is ReturnStatement {
    return node.type === Syntax.ReturnStatement;
}

export class Script extends BaseNode {
    readonly body: StatementListItem[];
    readonly sourceType: 'script';
    comments?: Comment[];
    tokens?: TokenEntry[];
    errors?: Error[];
    constructor(body: StatementListItem[]) {
        super(Syntax.Program);
        this.body = body;
        this.sourceType = 'script';
        assert(is_script(this), this.type);
    }
}

export function is_script(node: Node): node is Script {
    return is_program(node) && node.sourceType === 'script';
}

export function is_program(node: Node): node is Program {
    return node.type === Syntax.Program;
}

export class SequenceExpression extends BaseNode {
    readonly expressions: Expression[];
    constructor(expressions: Expression[]) {
        super(Syntax.SequenceExpression);
        this.expressions = expressions;
        assert(is_sequence_expression(this), this.type);
    }
}

export function is_sequence_expression(node: Node): node is SequenceExpression {
    return node.type === Syntax.SequenceExpression;
}

export class SpreadElement extends BaseNode {
    readonly argument: Expression;
    constructor(argument: Expression) {
        super(Syntax.SpreadElement);
        this.argument = argument;
        assert(is_spread_element(this), this.type);
    }
}

export function is_spread_element(node: Node): node is SpreadElement {
    return node.type === Syntax.SpreadElement;
}

export class Super {
    readonly type: string;
    constructor() {
        this.type = Syntax.Super;
    }
}

export class SwitchCase {
    readonly type: string;
    readonly test: Expression | null;
    readonly consequent: Statement[];
    constructor(test: Expression | null, consequent: Statement[]) {
        this.type = Syntax.SwitchCase;
        this.test = test;
        this.consequent = consequent;
    }
}

export class SwitchStatement {
    readonly type: string;
    readonly discriminant: Expression;
    readonly cases: SwitchCase[];
    constructor(discriminant: Expression, cases: SwitchCase[]) {
        this.type = Syntax.SwitchStatement;
        this.discriminant = discriminant;
        this.cases = cases;
    }
}

export class TaggedTemplateExpression {
    readonly type: string;
    readonly tag: Expression;
    readonly quasi: TemplateLiteral;
    constructor(tag: Expression, quasi: TemplateLiteral) {
        this.type = Syntax.TaggedTemplateExpression;
        this.tag = tag;
        this.quasi = quasi;
    }
}

export interface TemplateElementValue {
    cooked: string | null;
    raw: string;
}

export class TemplateElement {
    readonly type: string;
    readonly value: TemplateElementValue;
    readonly tail: boolean;
    constructor(value: TemplateElementValue, tail: boolean) {
        this.type = Syntax.TemplateElement;
        this.value = value;
        this.tail = tail;
    }
}

export class TemplateLiteral {
    readonly type: string;
    readonly quasis: TemplateElement[];
    readonly expressions: Expression[];
    constructor(quasis: TemplateElement[], expressions: Expression[]) {
        this.type = Syntax.TemplateLiteral;
        this.quasis = quasis;
        this.expressions = expressions;
    }
}

export class ThisExpression extends BaseNode {
    constructor() {
        super(Syntax.ThisExpression);
        assert(is_this_expression(this), this.type);
    }
}

export function is_this_expression(node: Node): node is ThisExpression {
    return node.type === Syntax.ThisExpression;
}

export class ThrowStatement {
    readonly type: string;
    readonly argument: Expression;
    constructor(argument: Expression) {
        this.type = Syntax.ThrowStatement;
        this.argument = argument;
    }
}

export class TryStatement {
    readonly type: string;
    readonly block: BlockStatement;
    readonly handler: CatchClause | null;
    readonly finalizer: BlockStatement | null;
    constructor(block: BlockStatement, handler: CatchClause | null, finalizer: BlockStatement | null) {
        this.type = Syntax.TryStatement;
        this.block = block;
        this.handler = handler;
        this.finalizer = finalizer;
    }
}

export class UnaryExpression extends BaseNode {
    readonly operator: '+' | '-' | '~' | '!' | 'delete' | 'typeof' | 'void';
    readonly argument: Expression;
    readonly prefix: boolean;
    constructor(operator: '+' | '-' | '~' | '!' | 'delete' | 'typeof' | 'void', argument: Expression) {
        super(Syntax.UnaryExpression);
        this.operator = operator;
        this.argument = argument;
        this.prefix = true;
        assert(is_unary_expression(this), this.type);
    }
}

export function is_unary_expression(node: Node): node is UnaryExpression {
    return node.type === Syntax.UnaryExpression;
}

export class UpdateExpression extends BaseNode {
    readonly operator: string;
    readonly argument: Expression;
    readonly prefix: boolean;
    constructor(operator: string, argument: Expression, prefix: boolean) {
        super(Syntax.UpdateExpression);
        this.operator = operator;
        this.argument = argument;
        this.prefix = prefix;
        assert(is_update_expression(this), this.type);
    }
}

export function is_update_expression(node: Node): node is UpdateExpression {
    return node.type === Syntax.UpdateExpression;
}

export class VariableDeclaration extends BaseNode {
    readonly declarations: VariableDeclarator[];
    readonly kind: string;
    constructor(declarations: VariableDeclarator[], kind: string) {
        super(Syntax.VariableDeclaration);
        this.declarations = declarations;
        this.kind = kind;
        assert(is_variable_declaration(this), this.type);
    }
}

export function is_variable_declaration(node: Node): node is VariableDeclaration {
    return node.type === Syntax.VariableDeclaration;
}

export class VariableDeclarator extends BaseNode {
    readonly id: BindingIdentifier | BindingPattern;
    readonly init: Expression | null;
    constructor(id: BindingIdentifier | BindingPattern, init: Expression | null) {
        super(Syntax.VariableDeclarator);
        this.id = id;
        this.init = init;
        assert(is_variable_declarator(this), this.type);
    }
}

export function is_variable_declarator(node: Node): node is VariableDeclarator {
    return node.type === Syntax.VariableDeclarator;
}

export class WhileStatement {
    readonly type: string;
    readonly test: Expression;
    readonly body: Statement;
    constructor(test: Expression, body: Statement) {
        this.type = Syntax.WhileStatement;
        this.test = test;
        this.body = body;
    }
}

export class WithStatement {
    readonly type: string;
    readonly object: Expression;
    readonly body: Statement;
    constructor(object: Expression, body: Statement) {
        this.type = Syntax.WithStatement;
        this.object = object;
        this.body = body;
    }
}

export class YieldExpression extends BaseNode {
    readonly argument: Expression | null;
    readonly delegate: boolean;
    constructor(argument: Expression | null, delegate: boolean) {
        super(Syntax.YieldExpression);
        this.argument = argument;
        this.delegate = delegate;
        assert(is_yield_expression(this), this.type);
    }
}

export function is_yield_expression(node: Node): node is YieldExpression {
    return node.type === Syntax.YieldExpression;
}
