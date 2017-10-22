/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import 'mocha';
import * as chai from 'chai';
import * as path from 'path';
import { FileSearchServiceImpl } from './file-search-service-impl';
import { FileUri } from '@theia/core/lib/node';
import { MockLogger } from '@theia/core/lib/common/test/mock-logger';

const expect = chai.expect;

describe('search-service', () => {
    it('shall fuzzy search this spec file', async () => {
        const service = new FileSearchServiceImpl(new MockLogger());
        const uri = FileUri.create(path.resolve(__dirname, "../../../.."));
        const matches = await service.find(uri.toString(), 'spc');
        const testFile = matches.find(e => e.endsWith(__filename));
        expect(testFile).to.eql(FileUri.create(__filename).toString());
    });

    it('shall respect nested .gitignore', async () => {
        const service = new FileSearchServiceImpl(new MockLogger());
        const uri = FileUri.create(path.resolve(__dirname, "../../test-data"));
        const matches = await service.find(uri.toString(), 'foo', { fuzzyMatch: false });

        expect(matches.some(e => e.endsWith('test-data/foo.txt'))).eq(false);
        expect(matches.some(e => e.endsWith('test-data/subdir1/sub-bar/foo.txt'))).eq(false);
        expect(matches.some(e => e.endsWith('test-data/subdir1/sub2/foo.txt'))).eq(true);
        expect(matches.some(e => e.endsWith('test-data/subdir1/foo.txt'))).eq(true);
    });

    it('shall respect nested .gitignore', async () => {
        const service = new FileSearchServiceImpl(new MockLogger());
        const uri = FileUri.create(path.resolve(__dirname, "../../../.."));
        const matches = await service.find(uri.toString(), 'node_modules', { fuzzyMatch: false });
        expect(matches.length).eq(0);
    });
});
