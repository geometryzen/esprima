import { parse, PrecedenceOperator } from "../src/index";
import { is_binary_expression, is_expression_statement, is_identifier, is_script } from "../src/nodes";
import { Syntax } from "../src/syntax";

function noopPrecedence(_operator: PrecedenceOperator): number | undefined {
    return void 0;
}

function customPrecedence(operator: PrecedenceOperator): number | undefined {
    switch (operator) {
        case ')': return 0;
        case ';': return 0;
        case ',': return 0;
        case '=': return 0;
        case ']': return 0;
        case '??': return 5;
        case '||': return 6;
        case '&&': return 7;
        // | moved down to bind more tightly (interior or scalar product).
        // ^ moved down to bind more tightly (exterior or wedge product).
        case '&': return 10;
        case '==': return 11;
        case '!=': return 11;
        case '===': return 11;
        case '!==': return 11;
        case '<': return 12;
        case '>': return 12;
        case '<=': return 12;
        case '>=': return 12;
        // << moved down to bind more tightly (left contraction).
        // >> moved down to bind more tightly (right contraction).
        case '>>>': return 13;
        case '+': return 14;
        case '-': return 14;
        case '*': return 15;
        case '/': return 15;
        case '^': return 16;
        case '|': return 17;
        case '<<': return 18;
        case '>>': return 18;
        case '%': return 19;
        default: throw new Error(`operator => '${operator}'`);
    }
}

// We first verify the precedence behavior in the normal cases.
// We check that the precedence rules are being applied.

// In the default case '*' binds more tightly than '<<'.
// It's also on the left and so association left could cause this.
test("a * b << c becomes (a * b) << c", function () {
    const node = parse("a * b << c");
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.BinaryExpression);
            if (is_binary_expression(expr)) {
                const L = expr.left;
                expect(L.type).toBe(Syntax.BinaryExpression);
                if (is_binary_expression(L)) {
                    const LL = L.left;
                    const LO = L.operator;
                    const LR = L.right;
                    expect(LL.type).toBe(Syntax.Identifier);
                    if (is_identifier(LL)) {
                        expect(LL.name).toBe("a");
                    }
                    expect(LO).toBe("*");
                    expect(LR.type).toBe(Syntax.Identifier);
                    if (is_identifier(LR)) {
                        expect(LR.name).toBe("b");
                    }
                }
                const O = expr.operator;
                expect(O).toBe("<<");
                const R = expr.right;
                expect(R.type).toBe(Syntax.Identifier);
                if (is_identifier(R)) {
                    expect(R.name).toBe("c");
                }
            }
        }
    }
});

// '*' binds more tightly than '<<'
test("a << b * c becomes a << (b * c)", function () {
    const node = parse("a << b * c");
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.BinaryExpression);
            if (is_binary_expression(expr)) {
                const L = expr.left;
                expect(L.type).toBe(Syntax.Identifier);
                if (is_identifier(L)) {
                    expect(L.name).toBe("a");
                }
                const O = expr.operator;
                expect(O).toBe("<<");
                const R = expr.right;
                expect(R.type).toBe(Syntax.BinaryExpression);
                if (is_binary_expression(R)) {
                    const RL = R.left;
                    const RO = R.operator;
                    const RR = R.right;
                    expect(RL.type).toBe(Syntax.Identifier);
                    if (is_identifier(RL)) {
                        expect(RL.name).toBe("b");
                    }
                    expect(RO).toBe("*");
                    expect(RR.type).toBe(Syntax.Identifier);
                    if (is_identifier(RR)) {
                        expect(RR.name).toBe("c");
                    }
                }
            }
        }
    }
});

// We now use an operator precedence function that should be a noop and expect no changes.

test("a * b << c becomes (a * b) << c with noop operator precedence", function () {
    const node = parse("a * b << c", { operatorPrecedence: noopPrecedence });
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.BinaryExpression);
            if (is_binary_expression(expr)) {
                const L = expr.left;
                expect(L.type).toBe(Syntax.BinaryExpression);
                if (is_binary_expression(L)) {
                    const LL = L.left;
                    const LO = L.operator;
                    const LR = L.right;
                    expect(LL.type).toBe(Syntax.Identifier);
                    if (is_identifier(LL)) {
                        expect(LL.name).toBe("a");
                    }
                    expect(LO).toBe("*");
                    expect(LR.type).toBe(Syntax.Identifier);
                    if (is_identifier(LR)) {
                        expect(LR.name).toBe("b");
                    }
                }
                const O = expr.operator;
                expect(O).toBe("<<");
                const R = expr.right;
                expect(R.type).toBe(Syntax.Identifier);
                if (is_identifier(R)) {
                    expect(R.name).toBe("c");
                }
            }
        }
        // console.log(JSON.stringify(body, null, 2));
    }
});

// We now use custom operator precedence to get '<<' to bind more tightly than '*'.

test("a * b << c becomes a * (b << c) with custom operator precedence", function () {
    const node = parse("a * b << c", { operatorPrecedence: customPrecedence });
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.BinaryExpression);
            if (is_binary_expression(expr)) {
                const L = expr.left;
                expect(L.type).toBe(Syntax.Identifier);
                if (is_identifier(L)) {
                    expect(L.name).toBe("a");
                }
                const O = expr.operator;
                expect(O).toBe("*");
                const R = expr.right;
                expect(R.type).toBe(Syntax.BinaryExpression);
                if (is_binary_expression(R)) {
                    const RL = R.left;
                    const RO = R.operator;
                    const RR = R.right;
                    expect(RL.type).toBe(Syntax.Identifier);
                    if (is_identifier(RL)) {
                        expect(RL.name).toBe("b");
                    }
                    expect(RO).toBe("<<");
                    expect(RR.type).toBe(Syntax.Identifier);
                    if (is_identifier(RR)) {
                        expect(RR.name).toBe("c");
                    }
                }
            }
        }
    }
});

// This test demonstrates that explicit parenthesis are redundant.

test("a * (b << c) becomes a * (b << c) with custom operator precedence", function () {
    // Notice that adding redundant parenthesis does not change anything.
    // This means that we could have compared the two parsed expressions (if equals were supported).
    const node = parse("a * (b << c)", { operatorPrecedence: customPrecedence });
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.BinaryExpression);
            if (is_binary_expression(expr)) {
                const L = expr.left;
                expect(L.type).toBe(Syntax.Identifier);
                if (is_identifier(L)) {
                    expect(L.name).toBe("a");
                }
                const O = expr.operator;
                expect(O).toBe("*");
                const R = expr.right;
                expect(R.type).toBe(Syntax.BinaryExpression);
                if (is_binary_expression(R)) {
                    const RL = R.left;
                    const RO = R.operator;
                    const RR = R.right;
                    expect(RL.type).toBe(Syntax.Identifier);
                    if (is_identifier(RL)) {
                        expect(RL.name).toBe("b");
                    }
                    expect(RO).toBe("<<");
                    expect(RR.type).toBe(Syntax.Identifier);
                    if (is_identifier(RR)) {
                        expect(RR.name).toBe("c");
                    }
                }
            }
        }
    }
});
