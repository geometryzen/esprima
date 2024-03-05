import { Comment, Node } from './javascript';
import { SourceLocation } from './scanner';
import { Syntax } from './syntax';
import { TokenEntry } from './token';

export type ArgumentListElement = Expression | SpreadElement;
export type ArrayExpressionElement = Expression | SpreadElement | null;
export type ArrayPatternElement = AssignmentPattern | BindingIdentifier | BindingPattern | RestElement | null;
export type BindingPattern = ArrayPattern | ObjectPattern;
export type BindingIdentifier = Identifier;
export type ChainElement = CallExpression | ComputedMemberExpression | StaticMemberExpression;
export type Declaration = AsyncFunctionDeclaration | ClassDeclaration | ExportDeclaration | FunctionDeclaration | ImportDeclaration | VariableDeclaration;
export type ExportableDefaultDeclaration = BindingIdentifier | BindingPattern | ClassDeclaration | Expression | FunctionDeclaration;
export type ExportableNamedDeclaration = AsyncFunctionDeclaration | ClassDeclaration | FunctionDeclaration | VariableDeclaration;
export type ExportDeclaration = ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration;
export type Expression = ArrayExpression | ArrowFunctionExpression | AssignmentExpression | AsyncArrowFunctionExpression | AsyncFunctionExpression |
    AwaitExpression | BinaryExpression | CallExpression | ChainExpression | ClassExpression | ComputedMemberExpression |
    ConditionalExpression | Identifier | FunctionExpression | Literal | NewExpression | ObjectExpression |
    RegexLiteral | SequenceExpression | StaticMemberExpression | TaggedTemplateExpression |
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
export type PropertyValue = AssignmentPattern | AsyncFunctionExpression | BindingIdentifier | BindingPattern | FunctionExpression;
export type StatementListItem = Declaration | Statement;

export function is_member_expression(node: Node): node is ComputedMemberExpression | StaticMemberExpression {
    return is_computed_member_expression(node) || is_static_member_expression(node);
}

export abstract class BaseNode implements Node {
    leadingComments?: Comment[];
    trailingComments?: Comment[];
    innerComments?: Comment[];
    range?: [number, number];
    loc?: SourceLocation;
    constructor(readonly type: string) {
    }
}

export class ArrayExpression {
    readonly type: string;
    readonly elements: ArrayExpressionElement[];
    constructor(elements: ArrayExpressionElement[]) {
        this.type = Syntax.ArrayExpression;
        this.elements = elements;
    }
}

export function is_array_expression(node: Node): node is ArrayExpression {
    return node.type === Syntax.ArrayExpression;
}

export class ArrayPattern {
    readonly type: string;
    readonly elements: ArrayPatternElement[];
    constructor(elements: ArrayPatternElement[]) {
        this.type = Syntax.ArrayPattern;
        this.elements = elements;
    }
}

export function is_array_pattern(node: Node): node is ArrayPattern {
    return node.type === Syntax.ArrayPattern;
}

export class ArrowFunctionExpression {
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
        this.async = false;
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
    }
}

export function is_arrow_parameter_placeholder(node: Node): node is ArrowParameterPlaceHolder {
    return node.type === Syntax.ArrowParameterPlaceHolder;
}

export class AssignmentExpression {
    readonly type: string;
    readonly operator: string;
    readonly left: Expression;
    readonly right: Expression;
    constructor(operator: string, left: Expression, right: Expression) {
        this.type = Syntax.AssignmentExpression;
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
}

export function is_assignment_expression(node: Node): node is AssignmentExpression {
    return node.type === Syntax.AssignmentExpression;
}

export class AssignmentPattern {
    readonly type: string;
    readonly left: BindingIdentifier | BindingPattern;
    readonly right: Expression;
    constructor(left: BindingIdentifier | BindingPattern, right: Expression) {
        this.type = Syntax.AssignmentPattern;
        this.left = left;
        this.right = right;
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

export class AsyncFunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(id: Identifier | null, params: FunctionParameter[], body: BlockStatement, generator: boolean) {
        this.type = Syntax.FunctionExpression;
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

export class BinaryExpression {
    readonly type: string;
    readonly operator: string;
    readonly left: Expression;
    readonly right: Expression;
    constructor(operator: string, left: Expression, right: Expression) {
        const logical = (operator === '||' || operator === '&&' || operator === '??');
        this.type = logical ? Syntax.LogicalExpression : Syntax.BinaryExpression;
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
}

export class BlockStatement extends BaseNode {
    readonly body: Statement[];
    constructor(body: Statement[]) {
        super(Syntax.BlockStatement);
        this.body = body;
    }
}

export function is_block_statement(node: Node): node is BlockStatement {
    return node.type === Syntax.BlockStatement;
}

export class BreakStatement {
    readonly type: string;
    readonly label: Identifier | null;
    constructor(label: Identifier | null) {
        this.type = Syntax.BreakStatement;
        this.label = label;
    }
}

export class CallExpression {
    readonly type: string;
    readonly callee: Expression | Import;
    readonly arguments: ArgumentListElement[];
    readonly optional: boolean;
    constructor(callee: Expression | Import, args: ArgumentListElement[], optional: boolean) {
        this.type = Syntax.CallExpression;
        this.callee = callee;
        this.arguments = args;
        this.optional = optional;
    }
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

export class ComputedMemberExpression {
    readonly type: string;
    readonly computed: boolean;
    readonly object: Expression;
    readonly property: Expression;
    readonly optional: boolean;
    constructor(object: Expression, property: Expression, optional: boolean) {
        this.type = Syntax.MemberExpression;
        this.computed = true;
        this.object = object;
        this.property = property;
        this.optional = optional;
    }
}

export function is_computed_member_expression(node: Node): node is ComputedMemberExpression {
    if (node.type === Syntax.MemberExpression) {
        return (node as ComputedMemberExpression).computed === true;
    }
    else {
        return false;
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

export class ExpressionStatement {
    readonly type: string;
    readonly expression: Expression;
    constructor(expression: Expression) {
        this.type = Syntax.ExpressionStatement;
        this.expression = expression;
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

export class FunctionDeclaration {
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
        this.async = false;
    }
}

export class FunctionExpression {
    readonly type: string;
    readonly id: Identifier | null;
    readonly params: FunctionParameter[];
    readonly body: BlockStatement;
    readonly generator: boolean;
    readonly expression: boolean;
    readonly async: boolean;
    constructor(id: Identifier | null, params: FunctionParameter[], body: BlockStatement, generator: boolean) {
        this.type = Syntax.FunctionExpression;
        this.id = id;
        this.params = params;
        this.body = body;
        this.generator = generator;
        this.expression = false;
        this.async = false;
    }
}

export class Identifier {
    readonly type: string;
    readonly name: string;
    constructor(name: string) {
        this.type = Syntax.Identifier;
        this.name = name;
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

export class LabeledStatement {
    readonly type: string;
    readonly label: Identifier;
    readonly body: Statement;
    constructor(label: Identifier, body: Statement) {
        this.type = Syntax.LabeledStatement;
        this.label = label;
        this.body = body;
    }
}

export class Literal {
    readonly type: string;
    readonly value: boolean | number | string | null;
    readonly raw: string;
    constructor(value: boolean | number | string | null, raw: string) {
        this.type = Syntax.Literal;
        this.value = value;
        this.raw = raw;
    }
}

export function is_literal(node: Node): node is Literal {
    return node.type === Syntax.Literal;
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

export class MethodDefinition {
    readonly type: string;
    readonly key: Expression | null;
    readonly computed: boolean;
    readonly value: AsyncFunctionExpression | FunctionExpression | null;
    readonly kind: string;
    readonly static: boolean;
    constructor(key: Expression | null, computed: boolean, value: AsyncFunctionExpression | FunctionExpression | null, kind: string, isStatic: boolean) {
        this.type = Syntax.MethodDefinition;
        this.key = key;
        this.computed = computed;
        this.value = value;
        this.kind = kind;
        this.static = isStatic;
    }
}

export class Module {
    readonly type: string;
    readonly body: StatementListItem[];
    readonly sourceType: string;
    comments?: Comment[];
    tokens?: TokenEntry[];
    errors?: Error[];
    constructor(body: StatementListItem[]) {
        this.type = Syntax.Program;
        this.body = body;
        this.sourceType = 'module';
    }
}

export function is_module(node: Node): node is Module {
    return node instanceof Module;
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

export class ObjectExpression {
    readonly type: string;
    readonly properties: ObjectExpressionProperty[];
    constructor(properties: ObjectExpressionProperty[]) {
        this.type = Syntax.ObjectExpression;
        this.properties = properties;
    }
}

export function is_object_expression(node: Node): node is ObjectExpression {
    return node.type === Syntax.ObjectExpression;
}

export class ObjectPattern {
    readonly type: string;
    readonly properties: ObjectPatternProperty[];
    constructor(properties: ObjectPatternProperty[]) {
        this.type = Syntax.ObjectPattern;
        this.properties = properties;
    }
}

export function is_object_pattern(node: Node): node is ObjectPattern {
    return node.type === Syntax.ObjectPattern;
}

export class Property {
    readonly type: string;
    readonly key: PropertyKey;
    readonly computed: boolean;
    readonly value: PropertyValue | null;
    readonly kind: 'get' | 'set' | 'init';
    readonly method: boolean;
    readonly shorthand: boolean;
    constructor(kind: 'get' | 'set' | 'init', key: PropertyKey, computed: boolean, value: PropertyValue | null, method: boolean, shorthand: boolean) {
        this.type = Syntax.Property;
        this.key = key;
        this.computed = computed;
        this.value = value;
        this.kind = kind;
        this.method = method;
        this.shorthand = shorthand;
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

export type RestElementArgument = ArrayPattern | AssignmentPattern | ComputedMemberExpression | Identifier | ObjectPattern | StaticMemberExpression;

export class RestElement {
    readonly type: string;
    readonly argument: RestElementArgument;
    constructor(argument: RestElementArgument) {
        this.type = Syntax.RestElement;
        this.argument = argument;
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

export class ReturnStatement {
    readonly type: string;
    readonly argument: Expression | null;
    constructor(argument: Expression | null) {
        this.type = Syntax.ReturnStatement;
        this.argument = argument;
    }
}

export class Script {
    readonly type: string;
    readonly body: StatementListItem[];
    readonly sourceType: string;
    comments?: Comment[];
    tokens?: TokenEntry[];
    errors?: Error[];
    constructor(body: StatementListItem[]) {
        this.type = Syntax.Program;
        this.body = body;
        this.sourceType = 'script';
    }
}

export function is_script(node: Node): node is Script {
    return node instanceof Script;
}

export function is_program(node: Node): node is Program {
    return is_module(node) || is_script(node);
}

export class SequenceExpression {
    readonly type: string;
    readonly expressions: Expression[];
    constructor(expressions: Expression[]) {
        this.type = Syntax.SequenceExpression;
        this.expressions = expressions;
    }
}

export function is_sequence_expression(node: Node): node is SequenceExpression {
    return node.type === Syntax.SequenceExpression;
}

export class SpreadElement {
    readonly type: string;
    readonly argument: Expression;
    constructor(argument: Expression) {
        this.type = Syntax.SpreadElement;
        this.argument = argument;
    }
}

export function is_spread_element(node: Node): node is SpreadElement {
    return node.type === Syntax.SpreadElement;
}

export class StaticMemberExpression {
    readonly type: string;
    readonly computed: boolean;
    readonly object: Expression;
    readonly property: Expression;
    readonly optional: boolean;
    constructor(object: Expression, property: Expression, optional: boolean) {
        this.type = Syntax.MemberExpression;
        this.computed = false;
        this.object = object;
        this.property = property;
        this.optional = optional;
    }
}

export function is_static_member_expression(node: Node): node is StaticMemberExpression {
    if (node.type === Syntax.MemberExpression) {
        return (node as StaticMemberExpression).computed === false;
    }
    else {
        return false;
    }
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

export class ThisExpression {
    readonly type: string;
    constructor() {
        this.type = Syntax.ThisExpression;
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

export class UnaryExpression {
    readonly type: string;
    readonly operator: string;
    readonly argument: Expression;
    readonly prefix: boolean;
    constructor(operator: string, argument: Expression) {
        this.type = Syntax.UnaryExpression;
        this.operator = operator;
        this.argument = argument;
        this.prefix = true;
    }
}

export class UpdateExpression {
    readonly type: string;
    readonly operator: string;
    readonly argument: Expression;
    readonly prefix: boolean;
    constructor(operator: string, argument: Expression, prefix: boolean) {
        this.type = Syntax.UpdateExpression;
        this.operator = operator;
        this.argument = argument;
        this.prefix = prefix;
    }
}

export class VariableDeclaration {
    readonly type: string;
    readonly declarations: VariableDeclarator[];
    readonly kind: string;
    constructor(declarations: VariableDeclarator[], kind: string) {
        this.type = Syntax.VariableDeclaration;
        this.declarations = declarations;
        this.kind = kind;
    }
}

export class VariableDeclarator {
    readonly type: string;
    readonly id: BindingIdentifier | BindingPattern;
    readonly init: Expression | null;
    constructor(id: BindingIdentifier | BindingPattern, init: Expression | null) {
        this.type = Syntax.VariableDeclarator;
        this.id = id;
        this.init = init;
    }
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

export class YieldExpression {
    readonly type: string;
    readonly argument: Expression | null;
    readonly delegate: boolean;
    constructor(argument: Expression | null, delegate: boolean) {
        this.type = Syntax.YieldExpression;
        this.argument = argument;
        this.delegate = delegate;
    }
}

export function is_yield_expression(node: Node): node is YieldExpression {
    return node.type === Syntax.YieldExpression;
}
