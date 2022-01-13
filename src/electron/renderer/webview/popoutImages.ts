// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    CSS_CLASS_NO_FOCUS_OUTLINE, POPOUTIMAGE_CONTAINER_CLASS, TTS_POPUP_DIALOG_CLASS,
} from "../../common/styles";
import { PopupDialog, closePopupDialogs } from "../common/popup-dialog";
import { IReadiumElectronWebviewWindow } from "./state";

export function popoutImage(
    win: IReadiumElectronWebviewWindow,
    element: HTMLImageElement,
    focusScrollRaw:
        (el: HTMLOrSVGElement, doFocus: boolean, animate: boolean, domRect: DOMRect | undefined) => void,
    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: () => number,
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: (val: number) => void,
) {
    // const documant = win.document || element.ownerDocument as Document;
    // if (!documant.documentElement
    //     || documant.documentElement.classList.contains(ROOT_CLASS_NO_POPOUTIMAGES)
    // ) {
    //     return false;
    // }

    const imgHref = element.src;
    if (!imgHref) {
        return;
    }

    const onclickhandler = "onclick=\"javascript: " +
        "if (window.event.shiftKey || this.r2ImgScale &amp;&amp; this.r2ImgScale !== 1) " +
        "{ this.r2ImgScale = !window.event.shiftKey ? " +
        "1 : (this.r2ImgScale ? (this.r2ImgScale + 0.5) : 1.5);" +
        "this.style.setProperty('margin-top', '0', 'important'); this.style.setProperty('margin-left', '0', 'important'); this.style.transform='scale('+this.r2ImgScale+')'; } " +
        "else if (window.readiumClosePopupDialogs) { window.readiumClosePopupDialogs(); } " +
        "window.event.preventDefault(); window.event.stopPropagation(); return false; \"";

    // tslint:disable-next-line:max-line-length
    const htmltxt = `
<div
    class="${POPOUTIMAGE_CONTAINER_CLASS} ${CSS_CLASS_NO_FOCUS_OUTLINE}"
    tabindex="0"
    autofocus="autofocus"
    onclick="javascript: window.readiumClosePopupDialogs &amp;&amp; window.readiumClosePopupDialogs()"
    >
    <img
        ${onclickhandler}
        src="${imgHref}"
    />
</div>`;

// ${win.document.documentElement.classList.contains(ROOT_CLASS_FIXED_LAYOUT) ?
//     "style=\"transform-origin: 0px 0px;transform: scale(var(--r2_fxl_scale));\"" :
//     ""}

    const val = ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable();

    // HACKY!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(win as any).readiumClosePopupDialogs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (win as any).readiumClosePopupDialogs = () => { closePopupDialogs(win.document); };
    }

    function onDialogClosed(el: HTMLOrSVGElement | null) {

        if (el) {
            focusScrollRaw(el, true, true, undefined);
        } else {
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable(val);
        }

        setTimeout(() => {
            pop.dialog.remove();
        }, 50);
    }
    const pop = new PopupDialog(element.ownerDocument as Document, htmltxt, onDialogClosed, TTS_POPUP_DIALOG_CLASS, false);
    pop.show(element);
}
