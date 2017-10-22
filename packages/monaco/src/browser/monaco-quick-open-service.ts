/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from 'inversify';
import { QuickOpenService, QuickOpenModel, QuickOpenOptions, QuickOpenItem, QuickOpenGroupItem, QuickOpenMode } from "@theia/core/lib/browser";
import { KEY_CODE_MAP } from './monaco-keycode-map';

export interface InternalMonacoQuickOpenModel extends monaco.quickOpen.IQuickOpenControllerOpts {
    readonly prefix?: string;
    onClose?(canceled: boolean): void;
}

@injectable()
export class MonacoQuickOpenService extends QuickOpenService {

    protected readonly container: HTMLElement;
    protected _widget: monaco.quickOpen.QuickOpenWidget | undefined;
    protected model: InternalMonacoQuickOpenModel | undefined;

    constructor() {
        super();
        const overlayWidgets = document.createElement('div');
        overlayWidgets.classList.add('quick-open-overlay');
        document.body.appendChild(overlayWidgets);

        const container = this.container = document.createElement('quick-open-container');
        container.style.position = 'absolute';
        container.style.top = '0px';
        container.style.right = '50%';
        overlayWidgets.appendChild(container);
    }

    open(model: QuickOpenModel, options?: QuickOpenOptions): void {
        this.internalOpen(new MonacoQuickOpenModel(model, options));
    }

    internalOpen(model: InternalMonacoQuickOpenModel): void {
        this.model = model;
        const widget = this.widget;
        widget.show(this.model.prefix || '');
        widget.setPlaceHolder(model.inputAriaLabel);
    }

    protected get widget(): monaco.quickOpen.QuickOpenWidget {
        if (this._widget) {
            return this._widget;
        }

        this._widget = new monaco.quickOpen.QuickOpenWidget(this.container, {
            onOk: () => this.onClose(false),
            onCancel: () => this.onClose(true),
            onType: lookFor => this.onType(lookFor || ''),
            onFocusLost: () => false
        }, {});
        this.attachQuickOpenStyler();
        this._widget.create();
        return this._widget;
    }

    protected attachQuickOpenStyler(): void {
        if (!this._widget) {
            return;
        }
        const themeService = monaco.services.StaticServices.standaloneThemeService.get();
        const detach = monaco.theme.attachQuickOpenStyler(this._widget, themeService);
        themeService.onThemeChange(() => {
            detach.dispose();
            this.attachQuickOpenStyler();
        });
    }

    protected onClose(cancelled: boolean): void {
        if (this.model && this.model.onClose) {
            this.model.onClose(cancelled);
        }
    }

    protected async onType(lookFor: string): Promise<void> {
        const options = this.model;
        if (this.widget && options) {
            options.onType(lookFor, model =>
                this.widget.setInput(model, options.getAutoFocus(lookFor), options.inputAriaLabel));
        }
    }

}

export class MonacoQuickOpenModel implements InternalMonacoQuickOpenModel {

    protected readonly options: QuickOpenOptions.Resolved;

    constructor(
        protected readonly model: QuickOpenModel,
        options?: QuickOpenOptions
    ) {
        this.model = model;
        this.options = QuickOpenOptions.resolve(options);
    }

    get prefix(): string {
        return this.options.prefix;
    }

    get inputAriaLabel(): string {
        return this.options.placeholder;
    }

    onClose(cancelled: boolean): void {
        this.options.onClose(cancelled);
    }

    onType(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void {
        this.model.onType(lookFor, items => {
            const entries: monaco.quickOpen.QuickOpenEntry[] = [];
            for (const item of items) {
                const entry = this.createEntry(item, lookFor);
                if (entry) {
                    entries.push(entry);
                }
            }
            if (this.options.fuzzySort) {
                entries.sort((a, b) => monaco.quickOpen.QuickOpenEntry.compare(a, b, lookFor));
            }
            const result = new monaco.quickOpen.QuickOpenModel(entries);
            acceptor(result);
        });
    }

    protected createEntry(item: QuickOpenItem, lookFor: string): monaco.quickOpen.QuickOpenEntry | undefined {
        const labelHighlights = this.options.fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel()) : item.getLabelHighlights();
        if (!labelHighlights && this.options.mustMatchLabel) {
            return undefined;
        }
        const descriptionHighlights = this.options.fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription()) : item.getDescriptionHighlights();
        const detailHighlights = this.options.fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail()) : item.getDetailHighlights();

        const entry = item instanceof QuickOpenGroupItem ? new QuickOpenEntryGroup(item) : new QuickOpenEntry(item);
        entry.setHighlights(labelHighlights || [], descriptionHighlights, detailHighlights);
        return entry;
    }

    protected matchesFuzzy(lookFor: string, value: string | undefined): monaco.quickOpen.IHighlight[] | undefined {
        if (!lookFor || !value) {
            return [];
        }
        return monaco.filters.matchesFuzzy(lookFor, value, true);
    }

    getAutoFocus(lookFor: string): monaco.quickOpen.IAutoFocus {
        return {
            autoFocusFirstEntry: true,
            autoFocusPrefixMatch: lookFor
        };
    }

}

export class QuickOpenEntry extends monaco.quickOpen.QuickOpenEntry {

    constructor(
        public readonly item: QuickOpenItem
    ) {
        super();
    }

    getLabel(): string | undefined {
        return this.item.getLabel();
    }

    getAriaLabel(): string | undefined {
        return this.item.getTooltip();
    }

    getDetail(): string | undefined {
        return this.item.getDetail();
    }

    getDescription(): string | undefined {
        return this.item.getDescription();
    }

    isHidden(): boolean {
        return super.isHidden() || this.item.isHidden();
    }

    getResource(): monaco.Uri | undefined {
        const uri = this.item.getUri();
        return uri ? monaco.Uri.parse(uri.toString()) : undefined;
    }

    getIcon(): string | undefined {
        return this.item.getIconClass();
    }

    getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined {
        const keybinding = this.item.getKeybinding();
        if (!keybinding) {
            return undefined;
        }
        const simple = new monaco.keybindings.SimpleKeybinding(
            keybinding.keyCode.ctrl,
            keybinding.keyCode.shift,
            keybinding.keyCode.alt,
            keybinding.keyCode.meta,
            KEY_CODE_MAP[keybinding.keyCode.key.keyCode]
        );
        return new monaco.keybindings.USLayoutResolvedKeybinding(simple, monaco.platform.OS);
    }

    run(mode: monaco.quickOpen.Mode): boolean {
        if (mode === monaco.quickOpen.Mode.OPEN) {
            return this.item.run(QuickOpenMode.OPEN);
        }
        if (mode === monaco.quickOpen.Mode.OPEN_IN_BACKGROUND) {
            return this.item.run(QuickOpenMode.OPEN_IN_BACKGROUND);
        }
        if (mode === monaco.quickOpen.Mode.PREVIEW) {
            return this.item.run(QuickOpenMode.PREVIEW);
        }
        return false;
    }

}

export class QuickOpenEntryGroup extends monaco.quickOpen.QuickOpenEntryGroup {

    constructor(
        public readonly item: QuickOpenGroupItem
    ) {
        super(new QuickOpenEntry(item));
    }

    getGroupLabel(): string {
        return this.item.getGroupLabel() || '';
    }

    showBorder(): boolean {
        return this.item.showBorder();
    }

}
