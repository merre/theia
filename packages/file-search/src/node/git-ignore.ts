/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as parser from 'gitignore-parser';
import * as fs from "fs";
import * as path from "path";

export interface GitIgnore {
    isFiltered(fileName: string): boolean;
}

export class GitIgnoreImpl implements GitIgnore {

    private positives: RegExp;
    private negatives: RegExp;

    constructor(gitIgnoreContent: string, private parent?: GitIgnore) {
        const result = parser.parse(gitIgnoreContent);
        this.negatives = new RegExp(result[0][0]);
        this.positives = new RegExp(result[1][0]);
    }

    isFiltered(fileName: string): boolean {
        if (this.positives.test(fileName)) {
            return false;
        }
        if (this.negatives.test(fileName)) {
            return true;
        }
        if (this.parent) {
            return this.parent.isFiltered(fileName);
        } else {
            return false;
        }
    }
}

export const NO_IGNORE: GitIgnore = {
    isFiltered(fileName: string): boolean { return false; }
};

export function findContainingGitIgnore(basePath: string): GitIgnore {
    const result = findGitIgnore(basePath, NO_IGNORE);
    if (result !== NO_IGNORE) {
        return result;
    }
    const parent = path.resolve(basePath, '..');
    if (parent === basePath) {
        return NO_IGNORE;
    }
    return findContainingGitIgnore(parent);
}

export function findGitIgnore(dir: string, parent: GitIgnore): GitIgnore {
    try {
        const fullPath = path.join(dir, '.gitignore');
        if (!fs.existsSync(fullPath)) {
            return parent;
        }
        const contents = fs.readFileSync(fullPath, 'utf-8');
        return new GitIgnoreImpl(contents, parent);
    } catch {
        return parent;
    }
}
