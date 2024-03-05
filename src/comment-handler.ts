import { Comment, Node } from './node';
import { is_block_statement, is_program } from './nodes';
import { BlockComment, is_block_comment, is_line_comment, LineComment, MetaData } from './parser';

interface Entry {
    comment: Comment;
    start: number;
}

interface NodeInfo {
    node: Node;
    start: number;
}

export class CommentHandler {
    attach: boolean;
    comments: Comment[];
    stack: NodeInfo[];
    leading: Entry[];
    trailing: Entry[];

    constructor() {
        this.attach = false;
        this.comments = [];
        this.stack = [];
        this.leading = [];
        this.trailing = [];
    }

    insertInnerComments(node: Node, metadata: MetaData): void {
        //  innnerComments for properties empty block
        //  `function a() {/** comments **\/}`
        if (is_block_statement(node) && node.body.length === 0) {
            const innerComments: Comment[] = [];
            for (let i = this.leading.length - 1; i >= 0; --i) {
                const entry = this.leading[i];
                if (metadata.end.offset >= entry.start) {
                    innerComments.unshift(entry.comment);
                    this.leading.splice(i, 1);
                    this.trailing.splice(i, 1);
                }
            }
            if (innerComments.length) {
                node.innerComments = innerComments;
            }
        }
    }

    findTrailingComments(metadata: MetaData): Comment[] {
        let trailingComments: Comment[] = [];

        if (this.trailing.length > 0) {
            for (let i = this.trailing.length - 1; i >= 0; --i) {
                const entry = this.trailing[i];
                if (entry.start >= metadata.end.offset) {
                    trailingComments.unshift(entry.comment);
                }
            }
            this.trailing.length = 0;
            return trailingComments;
        }

        const last = this.stack[this.stack.length - 1];
        if (last && last.node.trailingComments) {
            const firstComment = last.node.trailingComments[0];
            if (firstComment && Array.isArray(firstComment.range) && firstComment.range[0] >= metadata.end.offset) {
                trailingComments = last.node.trailingComments;
                delete last.node.trailingComments;
            }
        }
        return trailingComments;
    }

    findLeadingComments(metadata: MetaData): Comment[] | undefined {
        const leadingComments: Comment[] = [];

        let target: Node | undefined;
        while (this.stack.length > 0) {
            const entry = this.stack[this.stack.length - 1];
            if (entry && entry.start >= metadata.start.offset) {
                target = entry.node;
                this.stack.pop();
            } else {
                break;
            }
        }

        if (target) {
            if (target.leadingComments) {
                const count = target.leadingComments ? target.leadingComments.length : 0;
                for (let i = count - 1; i >= 0; --i) {
                    const comment = target.leadingComments[i];
                    if (Array.isArray(comment.range) && comment.range[1] <= metadata.start.offset) {
                        leadingComments.unshift(comment);
                        target.leadingComments.splice(i, 1);
                    }
                }
            }
            if (target.leadingComments && target.leadingComments.length === 0) {
                delete target.leadingComments;
            }
            return leadingComments;
        }

        for (let i = this.leading.length - 1; i >= 0; --i) {
            const entry = this.leading[i];
            if (entry.start <= metadata.start.offset) {
                leadingComments.unshift(entry.comment);
                this.leading.splice(i, 1);
            }
        }
        return leadingComments;
    }

    visitNode(node: Node, metadata: MetaData): void {
        if (is_program(node) && node.body.length > 0) {
            return;
        }

        this.insertInnerComments(node, metadata);
        const trailingComments = this.findTrailingComments(metadata);
        const leadingComments = this.findLeadingComments(metadata);
        if (Array.isArray(leadingComments) && leadingComments.length > 0) {
            node.leadingComments = leadingComments;
        }
        if (trailingComments.length > 0) {
            node.trailingComments = trailingComments;
        }

        this.stack.push({
            node: node,
            start: metadata.start.offset
        });
    }

    visitComment(node: LineComment | BlockComment, metadata: MetaData): void {
        const type = is_line_comment(node) ? 'Line' : 'Block';
        const comment: Comment = {
            type: type,
            value: node.value
        };
        if (node.range) {
            comment.range = node.range;
        }
        if (node.loc) {
            comment.loc = node.loc;
        }
        this.comments.push(comment);

        if (this.attach) {
            const entry: Entry = {
                comment: {
                    type: type,
                    value: node.value,
                    range: [metadata.start.offset, metadata.end.offset]
                },
                start: metadata.start.offset
            };
            if (node.loc) {
                entry.comment.loc = node.loc;
            }
            this.leading.push(entry);
            this.trailing.push(entry);
        }
    }

    visit(node: Node, metadata: MetaData): void {
        if (is_line_comment(node)) {
            this.visitComment(node, metadata);
        }
        else if (is_block_comment(node)) {
            this.visitComment(node, metadata);
        }
        else if (this.attach) {
            this.visitNode(node, metadata);
        }
    }

}
