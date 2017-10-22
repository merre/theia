/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from "inversify";
import { QuickOpenModel } from './quick-open-model';

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
    export interface Resolved {
        readonly prefix: string;
        readonly placeholder: string;
        onClose(canceled: boolean): void;

        readonly mustMatchLabel: boolean;
        readonly fuzzyMatchLabel: boolean;
        readonly fuzzyMatchDetail: boolean;
        readonly fuzzyMatchDescription: boolean;
        readonly fuzzySort: boolean;
    }
    export const defaultOptions: Resolved = Object.freeze({
        prefix: '',
        placeholder: '',
        onClose: () => { /* no-op*/ },
        mustMatchLabel: true,
        fuzzyMatchLabel: false,
        fuzzyMatchDetail: false,
        fuzzyMatchDescription: false,
        fuzzySort: false
    });
    export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
        return Object.assign({}, source, options);
    }
}

@injectable()
export class QuickOpenService {
    /**
     * It should be implemented by an extension, e.g. by the monaco extension.
     */
    open(model: QuickOpenModel, options?: QuickOpenOptions): void {
        // no-op
    }
}
