/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { FileSearchService } from '../common/file-search-service';
import * as fs from "fs";
import * as path from "path";
import URI from '@theia/core/lib/common/uri';
import { FileUri } from '@theia/core/lib/node';
import * as fuzzy from 'fuzzy';
import { injectable, inject } from 'inversify';
import { ILogger } from '@theia/core';
import { findContainingGitIgnore, NO_IGNORE, GitIgnore, findGitIgnore } from './git-ignore';

type Filtered = (simpleName: string, fullPath: string) => boolean;


@injectable()
export class FileSearchServiceImpl implements FileSearchService {

    constructor( @inject(ILogger) private logger: ILogger) { }

    async find(uri: string, searchPattern: string, options?: FileSearchService.Options): Promise<string[]> {
        const basePath = FileUri.fsPath(new URI(uri));
        const opts = {
            fuzzyMatch: true,
            limit: Number.MAX_SAFE_INTEGER,
            useGitignore: true,
            defaultIgnorePatterns: [
                '^.git$'
            ],
            ...options
        };
        const result: string[] = [];
        const limitReached = new Error("limit reached");
        const globalFiltered = this.getFiltered(basePath, opts);
        const gitignore = opts.useGitignore ? findContainingGitIgnore(basePath) : NO_IGNORE;
        try {
            this.findRecursive(basePath, globalFiltered, gitignore, opts, filePath => {
                if (result.length >= opts.limit) {
                    throw limitReached;
                }
                if (opts.fuzzyMatch && fuzzy.test(searchPattern, filePath)) {
                    result.push(FileUri.create(filePath).toString());
                } else {
                    if (filePath.toLocaleLowerCase().indexOf(searchPattern.toLocaleLowerCase()) !== -1) {
                        result.push(FileUri.create(filePath).toString());
                    }
                }
            });
        } catch (e) {
            if (e !== limitReached) {
                throw e;
            }
        }
        return result;
    }

    private findRecursive(filePath: string, globalFilter: Filtered, gitignore: GitIgnore, options: FileSearchService.Options, acceptor: (fileName: string) => void) {
        let result;
        try {
            result = fs.readdirSync(filePath);
        } catch (err) {
            this.logger.debug(`Skipping search in '${filePath}'.`, err);
            return;
        }
        let localGitIgnore = gitignore;
        if (fs.existsSync(path.join(filePath, '.git'))) {
            localGitIgnore = NO_IGNORE;
        }
        localGitIgnore = findGitIgnore(filePath, localGitIgnore);
        for (const child of result) {
            const childPath = path.join(filePath, child);
            if (!globalFilter(child, childPath) && !localGitIgnore.isFiltered(child)) {
                let stat;
                try {
                    stat = fs.statSync(childPath);
                } catch (err) {
                    this.logger.debug(`Skipping search in '${filePath}'.`, err);
                    return;
                }
                if (stat.isDirectory()) {
                    this.findRecursive(childPath, globalFilter, localGitIgnore, options, acceptor);
                } else {
                    acceptor(childPath);
                }
            }
        }
    }

    private getFiltered(basePath: string, options: FileSearchService.Options): Filtered {
        const patterns = options.defaultIgnorePatterns!.map(s => new RegExp(s));
        const defaultFilter = (simpleName: string) => patterns.some(pattern => pattern.test(simpleName));
        return defaultFilter;
    }

}
