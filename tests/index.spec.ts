import { parse } from "../src/index";
import { is_assignment_expression, is_expression_statement, is_script } from "../src/nodes";
import { Syntax } from "../src/syntax";

xtest("parse", function () {
    const node = parse("x=3");
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        const body = node.body;
        expect(body.length).toBe(1);
        const stmt = body[0];
        expect(stmt.type).toBe(Syntax.ExpressionStatement);
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.AssignmentExpression);
            if (is_assignment_expression(expr)) {
                const left = expr.left;
                expect(left.type).toBe(Syntax.Identifier);
                const operator = expr.operator;
                expect(operator).toBe("=");
                const right = expr.right;
                expect(right.type).toBe(Syntax.Literal);
            }
        }
        // console.log(JSON.stringify(body, null, 2));
    }
});
test("sandbox", function () {
    const node = parse("x++;");
    expect(node.type).toBe(Syntax.Program);
    if (is_script(node)) {
        console.log(JSON.stringify(node, null, 2))
        const body = node.body;
        expect(body.length).toBe(1);
        // const stmt = body[0];
        // expect(stmt.type).toBe(Syntax.VariableDeclaration);
        /*
        if (is_expression_statement(stmt)) {
            const expr = stmt.expression;
            expect(expr.type).toBe(Syntax.UpdateExpression);
        }
        */
        // console.log(JSON.stringify(body, null, 2));
    }
});
