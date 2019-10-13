// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as tabbable from "tabbable";

import { POPUP_DIALOG_CLASS } from "../../common/styles";

export interface IHTMLDialogElementWithPopup extends HTMLDialogElement {
    popDialog: PopupDialog | undefined;
}

export function isPopupDialogOpen(documant: Document): boolean {
    return documant.documentElement &&
        documant.documentElement.classList.contains(POPUP_DIALOG_CLASS);
}

export function closePopupDialogs(documant: Document) {
    const dialogs = documant.querySelectorAll(`dialog.${POPUP_DIALOG_CLASS}`);
    dialogs.forEach((dialog) => {
        const dia = dialog as IHTMLDialogElementWithPopup;
        if (dia.popDialog) {
            dia.popDialog.cancelRefocus();
        }
        if (dia.hasAttribute("open")) {
            dia.close();
        }
        setTimeout(() => {
            dia.remove();
        }, 50);
    });
}

export function isElementInsidePopupDialog(el: Element): boolean {

    let currentElement = el;

    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
        if (currentElement.tagName && currentElement.classList &&
            currentElement.tagName.toLowerCase() === "dialog" &&
            currentElement.classList.contains(POPUP_DIALOG_CLASS)) {
            return true;
        }
        currentElement = currentElement.parentNode as Element;
    }

    return false;
}

function getFocusables(rootElement: Element): HTMLOrSVGElement[] {
    // const FOCUSABLE_ELEMENTS = [
    //     "a[href]:not([tabindex^=\"-\"]):not([inert])",
    //     "area[href]:not([tabindex^=\"-\"]):not([inert])",
    //     "input:not([disabled]):not([inert])",
    //     "select:not([disabled]):not([inert])",
    //     "textarea:not([disabled]):not([inert])",
    //     "button:not([disabled]):not([inert])",
    //     "iframe:not([tabindex^=\"-\"]):not([inert])",
    //     "audio:not([tabindex^=\"-\"]):not([inert])",
    //     "video:not([tabindex^=\"-\"]):not([inert])",
    //     "[contenteditable]:not([tabindex^=\"-\"]):not([inert])",
    //     "[tabindex]:not([tabindex^=\"-\"]):not([inert])",
    // ];

    // const focusables: HTMLOrSVGElement[] = [];
    // const focusableElements = rootElement.querySelectorAll(FOCUSABLE_ELEMENTS.join(","));
    // focusableElements.forEach((focusableElement) => {

    //     if ((focusableElement as HTMLElement).offsetWidth ||
    //         (focusableElement as HTMLElement).offsetHeight ||
    //         focusableElement.getClientRects().length) {

    //         focusables.push((focusableElement as unknown) as HTMLOrSVGElement); // weird TypeScript!
    //     }
    // });
    // return focusables;

    const tabbables = tabbable(rootElement);
    return tabbables;
}
function focusInside(rootElement: Element) {
    const toFocus = rootElement.querySelector("[autofocus]") || getFocusables(rootElement)[0];
    if (toFocus) {
        (toFocus as HTMLOrSVGElement).focus();
    }
}

// interface IEventMap { [key: string]: Array<() => void>; }

let _focusedBeforeDialog: HTMLOrSVGElement | null;

function onKeyUp(this: PopupDialog, ev: KeyboardEvent) {
    // if (!this.shown) {
    //     return;
    // }

    const ESCAPE_KEY = 27;
    if (ev.which === ESCAPE_KEY) {
        if (this.role !== "alertdialog") {
            ev.preventDefault();
            this.dialog.close();
            return;
        }
    }
}

function onKeyDown(this: PopupDialog, ev: KeyboardEvent) {
    // if (!this.shown) {
    //     return;
    // }

    const TAB_KEY = 9;
    if (ev.which === TAB_KEY) {

        // if (ev.shiftKey && _focusedBeforeDialog) {
        //     this.focusScroll(_focusedBeforeDialog, false);
        // }

        const focusables = getFocusables(this.dialog);

        const focusedItemIndex = this.documant.activeElement ?
            focusables.indexOf((this.documant.activeElement as unknown) as HTMLOrSVGElement) : // weird TypeScript!
            -1;

        const isLast = focusedItemIndex === focusables.length - 1;
        const isFirst = focusedItemIndex === 0;

        let toFocus: HTMLOrSVGElement | undefined;

        if (ev.shiftKey && isFirst) {
            toFocus = focusables[focusables.length - 1];
        } else if (!ev.shiftKey && isLast) {
            toFocus = focusables[0];
        }

        if (toFocus) {
            ev.preventDefault();
            toFocus.focus();
        }
    }
}

// function onFocus(this: PopupDialog, ev: Event) {
//     // if (!this.shown) {
//     //     return;
//     // }

//     if (!this.dialog.contains(ev.target as Node)) {
//         ev.preventDefault();
//         focusInside(this.dialog);
//     }
// }

export class PopupDialog {

    public readonly role: string;
    public readonly dialog: IHTMLDialogElementWithPopup;

    private readonly _onKeyUp: () => void;
    private readonly _onKeyDown: () => void;
    // private readonly _onFocus: () => void;

    // private shown: boolean;
    // private listeners: IEventMap;

    constructor(
        public readonly documant: Document,
        outerHTML: string,
        // id: string,
        public readonly onDialogClosed: (el: HTMLOrSVGElement | null) => void,
        optionalCssClass?: string) {

        closePopupDialogs(documant);

        const that = this;

        this._onKeyUp = onKeyUp.bind(this);
        this._onKeyDown = onKeyDown.bind(this);
        // this._onFocus = onFocus.bind(this);

        this.dialog = documant.createElement("dialog") as IHTMLDialogElementWithPopup;
        this.dialog.popDialog = this;

        this.dialog.setAttribute("class", POPUP_DIALOG_CLASS
            + (optionalCssClass ? ` ${optionalCssClass}` : ""));
        this.dialog.setAttribute("id", POPUP_DIALOG_CLASS);
        this.dialog.setAttribute("dir", "ltr");

        // const button = documant.createElement("button");
        // button.setAttribute("aria-label", "close");
        // button.setAttribute("class", FOOTNOTES_CLOSE_BUTTON_CLASS);
        // const txtClose = documant.createTextNode("X");
        // button.appendChild(txtClose);
        // button.addEventListener("click", (_ev: Event) => {
        // if (that.dialog.hasAttribute("open")) {
        //     that.dialog.close();
        // }
        // });
        // this.dialog.appendChild(button);

        try {
            this.dialog.insertAdjacentHTML("beforeend", outerHTML);
        } catch (err) {
            console.log(err);
            console.log(outerHTML);
            try {
                this.dialog.innerHTML = outerHTML;
                // this.dialog.insertAdjacentHTML("afterbegin", button.outerHTML);
            } catch (err) {
                console.log(err);
                console.log(outerHTML);
            }
        }

        // const input = documant.createElement("input");
        // input.setAttribute("type", "text");
        // this.dialog.appendChild(input);

        // const butt = documant.createElement("button");
        // butt.appendChild(documant.createTextNode("TEST FOCUS CYCLE"));
        // this.dialog.appendChild(butt);

        // const buttx = documant.createElement("a");
        // buttx.setAttribute("href", "http://domain.org");
        // buttx.appendChild(documant.createTextNode("TEST OTHER"));
        // this.dialog.appendChild(buttx);

        documant.body.appendChild(this.dialog);
        // debug(this.dialog.outerHTML);

        this.dialog.addEventListener("click", (ev) => {
            if (ev.target !== that.dialog) {
                return;
            }
            const rect = that.dialog.getBoundingClientRect();
            const inside = rect.top <= ev.clientY &&
                ev.clientY <= rect.top + rect.height &&
                rect.left <= ev.clientX &&
                ev.clientX <= rect.left + rect.width;
            if (!inside) {
                if (that.dialog.hasAttribute("open")) {
                    that.dialog.close();
                }
            }
        });

        this.dialog.addEventListener("close", (_ev) => {
            that.hide();
        });

        this.documant = this.dialog.ownerDocument as Document;

        this.role = this.dialog.getAttribute("role") || "dialog";

        // this.shown = this.dialog.hasAttribute("open");

        // this.listeners = {};
    }

    // public on(type: string, handler: () => void) {
    //     if (!this.listeners[type]) {
    //         this.listeners[type] = [];
    //     }

    //     this.listeners[type].push(handler);

    //     return this;
    // }

    // public off(type: string, handler: () => void) {
    //     const index = this.listeners[type].indexOf(handler);
    //     if (index >= 0) {
    //         this.listeners[type].splice(index, 1);
    //     }
    //     return this;
    // }

    public show(toRefocus: Element | undefined) {
        // if (this.shown) {
        //     return;
        // }
        // this.shown = true;

        const el = this.documant.documentElement;
        el.classList.add(POPUP_DIALOG_CLASS);

        if (this.dialog.hasAttribute("open")) {
            return;
        }

        _focusedBeforeDialog = toRefocus ?
            toRefocus as HTMLElement :
            (this.documant.activeElement as unknown) as HTMLOrSVGElement; // weird TypeScript

        this.dialog.showModal();

        focusInside(this.dialog);

        // this.documant.body.addEventListener("focus", this._onFocus, true);
        this.documant.body.addEventListener("keyup", this._onKeyUp, true);
        this.documant.body.addEventListener("keydown", this._onKeyDown, true);

        // this.fire("show");
    }

    public cancelRefocus() {
        _focusedBeforeDialog = null;
    }

    public hide() {
        // if (!this.shown) {
        //     return;
        // }
        // this.shown = false;

        const el = this.documant.documentElement;
        el.classList.remove(POPUP_DIALOG_CLASS);

        // this.documant.body.removeEventListener("focus", this._onFocus, true);
        this.documant.body.removeEventListener("keyup", this._onKeyUp, true);
        this.documant.body.removeEventListener("keydown", this._onKeyDown, true);

        this.onDialogClosed(_focusedBeforeDialog);
        _focusedBeforeDialog = null;

        // let the above occur even if not open!
        if (this.dialog.hasAttribute("open")) {
            this.dialog.close();
        }

        // this.fire("hide");
    }

    // public destroy() {
    //     this.hide();

    //     // this.fire("destroy");

    //     // this.listeners = {};
    // }

    // private fire(type: string) {
    //     if (!this.listeners[type]) {
    //         return;
    //     }
    //     this.listeners[type].forEach((listener) => {
    //         listener();
    //     });
    // }
}
