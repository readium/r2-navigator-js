// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    FOOTNOTES_CONTAINER_CLASS,
    ROOT_CLASS_NO_FOOTNOTES,
} from "../../common/styles";
import { PopupDialog } from "../common/popup-dialog";

export function popupFootNote(
    element: HTMLElement,
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void,
    href: string): boolean {

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

    const url = new URL(href); // includes #
    if (!url.hash) {
        return false;
    }
    // const targetElement = win.document.getElementById(url.hash.substr(1));
    const targetElement = documant.querySelector(url.hash);
    if (!targetElement) {
        return false;
    }

    const ID_PREFIX = "r2-footnote-popup-dialog-for_";
    const id = ID_PREFIX + targetElement.id;
    const existingDialog = documant.getElementById(id);
    if (existingDialog) {
        ((existingDialog as any).popDialog as PopupDialog).show(element);
        return true;
    }

    let outerHTML = targetElement.outerHTML;
    if (!outerHTML) {
        return false;
    }

    outerHTML = outerHTML.replace(/xmlns=["']http:\/\/www.w3.org\/1999\/xhtml["']/g, " ");
    outerHTML = outerHTML.replace(/xmlns:epub=["']http:\/\/www.idpf.org\/2007\/ops["']/g, " ");
    outerHTML = outerHTML.replace(/epub:type=["'][^"']+["']/g, " ");
    outerHTML = outerHTML.replace(/<script>.+<\/script>/g, " ");

    const ID_PREFIX_ = "r2-footnote-content-of_";
    const id_ = ID_PREFIX_ + targetElement.id;
    outerHTML = outerHTML.replace(/id=["'][^"']+["']/, `id="${id_}"`);

    outerHTML = `<div class="${FOOTNOTES_CONTAINER_CLASS}">${outerHTML}</div>`;

    // outerHTML = outerHTML.replace(/click=["']javascript:.+["']/g, " ");
    // debug(outerHTML);

    // import * as xmldom from "xmldom";
    // const dom = new xmldom.DOMParser().parseFromString(outerHTML, "application/xhtml+xml");

    // const payload_: IEventPayload_R2_EVENT_LINK_FOOTNOTE = {
    //     hash: url.hash,
    //     html: outerHTML,
    //     url: href,
    // };
    // ipcRenderer.sendToHost(R2_EVENT_LINK_FOOTNOTE, payload_);

    function endToScrollAndFocus(el: HTMLOrSVGElement | null, doFocus: boolean) {
        if (el) {
            focusScrollRaw(el, doFocus);
        }
    }
    const pop = new PopupDialog(documant, outerHTML, id, endToScrollAndFocus);

    pop.show(element);
    return true;
}
