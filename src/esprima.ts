/*
  Copyright JS Foundation and other contributors, https://js.foundation/

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { CommentHandler } from './comment-handler';
import { Node } from './javascript';
import { JSXParser } from './jsx-parser';
import { Module, Program, Script } from './nodes';
import { MetaData, Parser } from './parser';
import { TokenEntry } from './token';
import { BufferEntry, Tokenizer, TokenizerConfig } from './tokenizer';

export interface ParseOptions {
    comment?: boolean;
    attachComment?: boolean;
    sourceType?: 'module' | 'script';
    jsx?: boolean;
    range?: boolean;
    loc?: boolean;
    tokens?: boolean;
    tolerant?: boolean;
    source?: string;
}

/**
 *
 */
export type ParseDelegate = (node: Node, metadata: MetaData) => void;

export function parse(sourceText: string, options?: ParseOptions, delegate?: ParseDelegate): Program {
    let commentHandler: CommentHandler | null = null;
    const proxyDelegate: ParseDelegate = (node, metadata) => {
        if (delegate) {
            delegate(node, metadata);
        }
        if (commentHandler) {
            commentHandler.visit(node, metadata);
        }
    };

    let parserDelegate = (typeof delegate === 'function') ? proxyDelegate : undefined;
    let collectComment = false;
    if (options) {
        collectComment = (typeof options.comment === 'boolean' && options.comment);
        const attachComment = (typeof options.attachComment === 'boolean' && options.attachComment);
        if (collectComment || attachComment) {
            commentHandler = new CommentHandler();
            commentHandler.attach = attachComment;
            options.comment = true;
            parserDelegate = proxyDelegate;
        }
    }

    let isModule = false;
    if (options && typeof options.sourceType === 'string') {
        isModule = (options.sourceType === 'module');
    }

    let parser: Parser;
    if (options && typeof options.jsx === 'boolean' && options.jsx) {
        parser = new JSXParser(sourceText, options, parserDelegate);
    }
    else {
        parser = new Parser(sourceText, options, parserDelegate);
    }

    const program = isModule ? parser.parseModule() : parser.parseScript();

    if (collectComment && commentHandler) {
        program.comments = commentHandler.comments;
    }
    if (parser.config.tokens) {
        program.tokens = parser.tokens;
    }
    if (parser.config.tolerant) {
        program.errors = parser.errorHandler.errors;
    }

    return program;
}

export function parseModule(sourceText: string, options: ParseOptions = {}, delegate?: ParseDelegate): Module {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'module';
    return parse(sourceText, parsingOptions, delegate);
}

export function parseScript(sourceText: string, options: ParseOptions = {}, delegate?: ParseDelegate): Script {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'script';
    return parse(sourceText, parsingOptions, delegate);
}

export function tokenize(code: string, options: TokenizerConfig, delegate?: (token: TokenEntry) => TokenEntry): TokenEntry[] {
    const tokenizer = new Tokenizer(code, options);

    const tokens: BufferEntry[] = [];

    try {
        while (true) {
            let token = tokenizer.getNextToken();
            if (!token) {
                break;
            }
            if (delegate) {
                token = delegate(token);
            }
            tokens.push(token);
        }
    }
    catch (e) {
        tokenizer.errorHandler.tolerate(e);
    }

    if (tokenizer.errorHandler.tolerant) {
        // Yeah, this is ugly.
        (tokens as unknown as { [name: string]: Error[] })['errors'] = tokenizer.errors();
    }

    return tokens;
}

export { Syntax } from './syntax';

// Sync with *.json manifests.
export const version = '0.9.10';
