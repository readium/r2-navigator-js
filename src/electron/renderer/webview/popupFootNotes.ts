// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    CSS_CLASS_NO_FOCUS_OUTLINE, FOOTNOTES_CONTAINER_CLASS, ROOT_CLASS_NO_FOOTNOTES,
} from "../../common/styles";
import { PopupDialog } from "../common/popup-dialog";

export function popupFootNote(
    element: HTMLElement,
    focusScrollRaw:
        (el: HTMLOrSVGElement, doFocus: boolean, animate: boolean, domRect: DOMRect | undefined) => void,
    href: string,
    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: () => number,
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: (val: number) => void,
    ): boolean {

    const documant = element.ownerDocument as Document;
    if (!documant.documentElement ||
        documant.documentElement.classList.contains(ROOT_CLASS_NO_FOOTNOTES)) {
        return false;
    }

    let epubType = element.getAttribute("epub:type");
    if (!epubType) {
        epubType = element.getAttributeNS("http://www.idpf.org/2007/ops", "type");
    }
    if (!epubType) {
        return false;
    }

    // epubType.indexOf("biblioref") >= 0 ||
    // epubType.indexOf("glossref") >= 0 ||
    // epubType.indexOf("annoref") >= 0
    const isNoteref = epubType.indexOf("noteref") >= 0;
    if (!isNoteref) {
        return false;
    }

    const url = new URL(href);
    if (!url.hash) { // includes #
        return false;
    }
    // const targetElement = win.document.getElementById(url.hash.substr(1));
    const targetElement = documant.querySelector(url.hash);
    if (!targetElement) {
        return false;
    }

    // const existingDialog = documant.getElementById(id) as IHTMLDialogElementWithPopup;
    // if (existingDialog && existingDialog.popDialog) {
    //     existingDialog.popDialog.show(element);
    //     return true;
    // }

    let htmltxt = targetElement.innerHTML;
    if (!htmltxt) {
        return false;
    }

    htmltxt = htmltxt.replace(/xmlns=["']http:\/\/www.w3.org\/1999\/xhtml["']/g, " ");
    htmltxt = htmltxt.replace(/xmlns:epub=["']http:\/\/www.idpf.org\/2007\/ops["']/g, " ");
    // htmltxt = htmltxt.replace(/epub:type=["'][^"']+["']/g, " ");
    htmltxt = htmltxt.replace(/<script>.+<\/script>/g, " ");

    const ID_PREFIX_ = "r2-footnote-for_";
    const id_ = ID_PREFIX_ + targetElement.id;
    // htmltxt = htmltxt.replace(/id=["'][^"']+["']/, `id="${id_}"`);
    htmltxt = htmltxt.replace(/id=["']([^"']+)["']/g, `idvoid="$1"`); // remove duplicate IDs

    // tslint:disable-next-line:max-line-length
    htmltxt = `<div id="${id_}" class="${FOOTNOTES_CONTAINER_CLASS} ${CSS_CLASS_NO_FOCUS_OUTLINE}" tabindex="0" autofocus="autofocus">${htmltxt}</div>`;

    // htmltxt = htmltxt.replace(/click=["']javascript:.+["']/g, " ");
    // debug(htmltxt);

    // import * as xmldom from "xmldom";
    // not application/xhtml+xml because:
    // https://github.com/jindw/xmldom/pull/208
    // https://github.com/jindw/xmldom/pull/242
    // https://github.com/xmldom/xmldom/blob/3db6ccf3f7ecbde73608490d71f96c727abdd69a/lib/dom-parser.js#L12
    // const dom = new xmldom.DOMParser().parseFromString(htmltxt, "application/xhtml");

    // const payload_: IEventPayload_R2_EVENT_LINK_FOOTNOTE = {
    //     hash: url.hash,
    //     html: htmltxt,
    //     url: href,
    // };
    // ipcRenderer.sendToHost(R2_EVENT_LINK_FOOTNOTE, payload_);

    const val = ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable();

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
    const pop = new PopupDialog(documant, htmltxt, onDialogClosed);

    pop.show(element);
    return true;
}
