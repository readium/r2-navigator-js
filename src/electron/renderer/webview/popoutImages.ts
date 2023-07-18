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
    // https://github.com/jackmoore/wheelzoom/blob/05224659740eea775a779faa62cef0ec0126082/wheelzoom.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (win as any).wheelzoom = (img: HTMLImageElement) => {
        const zoomStep = 0.10;

        let viewportWidth = 0;
        let viewportHeight = 0;
        let naturalWidth = 0;
        let naturalHeight = 0;
        let containedWidth = 0;
        let containedHeight = 0;

        let bgWidth = 0;
        let bgHeight = 0;
        let bgPosX = 0;
        let bgPosY = 0;

        let touchHypot = 0;

        let previousEvent: MouseEvent | undefined;
        let previousEventTouch: TouchEvent | undefined;

        function updateBgStyle() {
            // if (bgPosX > 0) {
            //     bgPosX = 0;
            // } else if (bgPosX < width - bgWidth) {
            //     bgPosX = width - bgWidth;
            // }

            // if (bgPosY > 0) {
            //     bgPosY = 0;
            // } else if (bgPosY < height - bgHeight) {
            //     bgPosY = height - bgHeight;
            // }

            img.style.backgroundSize = bgWidth + "px " + bgHeight + "px";
            img.style.backgroundPosition = bgPosX + "px " + bgPosY + "px";
        }

        function ontouch(e: TouchEvent) {
            e.preventDefault();
            e.stopPropagation();

            if (e.targetTouches.length !== 2) {
                return;
            }

            const pageX1 = e.targetTouches[0].clientX;
            const pageY1 = e.targetTouches[0].clientY;

            const pageX2 = e.targetTouches[1].clientX;
            const pageY2 = e.targetTouches[1].clientY;

            // Math.hypot()
            const touchHypot_ = Math.round(Math.sqrt(Math.pow(Math.abs(pageX1 - pageX2), 2) + Math.pow(Math.abs(pageY1 - pageY2), 2)));

            let direction = 0;
            if (touchHypot_ > touchHypot + 5) direction = -1;
            if (touchHypot_ < touchHypot - 5) direction = 1;

            if (direction !== 0) {
                if (touchHypot || direction === 1) {

                    const pageX = Math.min(pageX1, pageX2) + (Math.abs(pageX1 - pageX2) / 2);
                    const pageY = Math.min(pageY1, pageY2) + (Math.abs(pageY1 - pageY2) / 2);

                    const rect = img.getBoundingClientRect();
                    const offsetX = pageX - rect.left - window.pageXOffset;
                    const offsetY = pageY - rect.top - window.pageYOffset;

                    const bgCursorX = offsetX - bgPosX;
                    const bgCursorY = offsetY - bgPosY;

                    const bgRatioX = bgCursorX / bgWidth;
                    const bgRatioY = bgCursorY / bgHeight;

                    if (direction < 0) {
                        bgWidth += bgWidth * zoomStep;
                        bgHeight += bgHeight * zoomStep;
                    } else {
                        bgWidth -= bgWidth * zoomStep;
                        bgHeight -= bgHeight * zoomStep;
                    }

                    bgPosX = offsetX - (bgWidth * bgRatioX);
                    bgPosY = offsetY - (bgHeight * bgRatioY);

                    updateBgStyle();
                }

                touchHypot = touchHypot_;
            }
        }

        function onwheel(e: WheelEvent) {
            e.preventDefault();
            e.stopPropagation();

            const rect = img.getBoundingClientRect();
            const offsetX = e.pageX - rect.left - window.pageXOffset;
            const offsetY = e.pageY - rect.top - window.pageYOffset;

            const bgCursorX = offsetX - bgPosX;
            const bgCursorY = offsetY - bgPosY;

            const bgRatioX = bgCursorX / bgWidth;
            const bgRatioY = bgCursorY / bgHeight;

            if (e.deltaY < 0) {
                bgWidth += bgWidth * zoomStep;
                bgHeight += bgHeight * zoomStep;
            } else {
                bgWidth -= bgWidth * zoomStep;
                bgHeight -= bgHeight * zoomStep;
            }

            bgPosX = offsetX - (bgWidth * bgRatioX);
            bgPosY = offsetY - (bgHeight * bgRatioY);

            updateBgStyle();
        }

        // let clickDownUpHasMovedTouch = false;
        function dragtouch(e: TouchEvent) {
            if (e.targetTouches.length !== 1) {
                return;
            }
            // clickDownUpHasMovedTouch = true;
            e.preventDefault();
            const pageX = e.targetTouches[0].clientX;
            const pageY = e.targetTouches[0].clientY;
            bgPosX += (pageX - (previousEventTouch?.targetTouches[0].clientX || 0));
            bgPosY += (pageY - (previousEventTouch?.targetTouches[0].clientY || 0));
            previousEventTouch = e;
            updateBgStyle();
        }

        function removeDragtouch(e: TouchEvent) {
            if (e.targetTouches.length !== 1) {
                return;
            }
            // clickDownUpHasMovedTouch = false;
            e.preventDefault();
            e.stopPropagation();
            previousEventTouch = undefined;
            img.removeEventListener("touchend", removeDragtouch);
            img.removeEventListener("touchmove", dragtouch);
        }

        function draggabletouch(e: TouchEvent) {
            if (e.targetTouches.length !== 1) {
                return;
            }
            // clickDownUpHasMovedTouch = false;
            e.preventDefault();
            previousEventTouch = e;
            img.addEventListener("touchmove", dragtouch);
            img.addEventListener("touchend", removeDragtouch);
        }

        let clickDownUpHasMoved = false;
        function drag(e: MouseEvent) {
            clickDownUpHasMoved = true;
            e.preventDefault();
            bgPosX += (e.pageX - (previousEvent?.pageX || 0));
            bgPosY += (e.pageY - (previousEvent?.pageY || 0));
            previousEvent = e;
            updateBgStyle();
        }

        function removeDrag(e: MouseEvent) {
            // clickDownUpHasMoved = false;
            e.preventDefault();
            e.stopPropagation();
            previousEvent = undefined;
            document.removeEventListener("mouseup", removeDrag);
            document.removeEventListener("mouseleave", removeDrag);
            document.removeEventListener("mousemove", drag);
        }

        function draggable(e: MouseEvent) {
            clickDownUpHasMoved = false;
            e.preventDefault();
            previousEvent = e;
            document.addEventListener("mousemove", drag);
            document.addEventListener("mouseup", removeDrag);
            document.addEventListener("mouseleave", removeDrag);
        }

        function onclick(e: MouseEvent | undefined, force?: boolean) {
            if (!force && (previousEvent || clickDownUpHasMoved)) {
                return;
            }
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            const initialZoom = 1;
            bgWidth = containedWidth * initialZoom;
            bgHeight = containedHeight * initialZoom;
            bgPosX = -(bgWidth - viewportWidth) * 0.5;
            bgPosY = -(bgHeight - viewportHeight) * 0.5;

            updateBgStyle();
        }

        function reset() {
            const computedStyle = window.getComputedStyle(img, null);
            viewportWidth = parseInt(computedStyle.width, 10);
            viewportHeight = parseInt(computedStyle.height, 10);

            const hRatio = naturalHeight / viewportHeight;
            const wRatio = naturalWidth / viewportWidth;

            containedWidth = viewportWidth;
            containedHeight = viewportHeight;
            if (hRatio > wRatio) {
                containedWidth = naturalWidth / hRatio;
            } else if (hRatio < wRatio) {
                containedHeight = naturalHeight / wRatio;
            }
        }

        function init() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((img as any).__INITED) {
                return;
            }

            naturalHeight = img.naturalHeight;
            naturalWidth = img.naturalWidth;

            reset();

            img.style.backgroundRepeat = "no-repeat";
            img.style.backgroundImage = "url(\"" + img.src + "\")";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (img as any).__INITED = true;
            img.src = "data:image/svg+xml;base64," + window.btoa("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + naturalWidth + "\" height=\"" + naturalHeight + "\"></svg>");

            onclick(undefined, true);

            img.addEventListener("wheel", onwheel);
            img.addEventListener("touchmove", ontouch);
            img.addEventListener("touchstart", draggabletouch);
            img.addEventListener("mousedown", draggable);
            img.addEventListener("click", onclick);

            const resizeObserver = new window.ResizeObserver((_entries) => {
                reset();
                onclick(undefined, true);
            });
            resizeObserver.observe(img);
            // img.addEventListener("resize", () => {
            //     reset();
            //     onclick(undefined, true);
            // });

            (win.document.getElementById("imgZoomClose") as HTMLElement).focus();
            (win.document.getElementById("imgZoomClose") as HTMLElement).addEventListener("click", () => {
                closePopupDialogs(win.document);
            });
            (win.document.getElementById("imgZoomReset") as HTMLElement).addEventListener("click", () => {
                onclick(undefined, true);
            });
            (win.document.getElementById("imgZoomMinus") as HTMLElement).addEventListener("click", () => {
                // bgWidth -= bgWidth * zoomStep;
                // bgHeight -= bgHeight * zoomStep;

                const offsetX = viewportWidth / 2;
                const offsetY = viewportHeight / 2;

                const bgCursorX = offsetX - bgPosX;
                const bgCursorY = offsetY - bgPosY;

                const bgRatioX = bgCursorX / bgWidth;
                const bgRatioY = bgCursorY / bgHeight;

                bgWidth -= bgWidth * zoomStep;
                bgHeight -= bgHeight * zoomStep;

                bgPosX = offsetX - (bgWidth * bgRatioX);
                bgPosY = offsetY - (bgHeight * bgRatioY);

                updateBgStyle();
            });
            (win.document.getElementById("imgZoomPlus") as HTMLElement).addEventListener("click", () => {
                // bgWidth += bgWidth * zoomStep;
                // bgHeight += bgHeight * zoomStep;

                const offsetX = viewportWidth / 2;
                const offsetY = viewportHeight / 2;

                const bgCursorX = offsetX - bgPosX;
                const bgCursorY = offsetY - bgPosY;

                const bgRatioX = bgCursorX / bgWidth;
                const bgRatioY = bgCursorY / bgHeight;

                bgWidth += bgWidth * zoomStep;
                bgHeight += bgHeight * zoomStep;

                bgPosX = offsetX - (bgWidth * bgRatioX);
                bgPosY = offsetY - (bgHeight * bgRatioY);

                updateBgStyle();
            });

        }
        init();
        // if (img.complete) {
        //     init();
        // }
        // img.addEventListener("load", init);
    };

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

    // const onclickhandler = "onclick=\"javascript: " +
    //     "if (window.event.shiftKey || this.r2ImgScale &amp;&amp; this.r2ImgScale !== 1) " +
    //     "{ this.r2ImgScale = !window.event.shiftKey ? " +
    //     "1 : (this.r2ImgScale ? (this.r2ImgScale + 0.5) : 1.5);" +
    //     "this.style.setProperty('margin-top', '0', 'important'); this.style.setProperty('margin-left', '0', 'important'); this.style.transform='scale('+this.r2ImgScale+')'; } " +
    //     "else if (window.readiumClosePopupDialogs) { window.readiumClosePopupDialogs(); } " +
    //     "window.event.preventDefault(); window.event.stopPropagation(); return false; \"";

    // const onclickhandler = "onclick=\"javascript: " +
    //     "if (window.event.shiftKey &amp;&amp; window.readiumClosePopupDialogs) { window.readiumClosePopupDialogs(); }" +
    //     "window.event.preventDefault(); window.event.stopPropagation(); return false; \"";

    const onloadhandler = "onload=\"javascript: " +
        "window.wheelzoom(this);" +
        "return; \"";

    // tslint:disable-next-line:max-line-length
    const htmltxt = `
<div
    class="${POPOUTIMAGE_CONTAINER_CLASS} ${CSS_CLASS_NO_FOCUS_OUTLINE}"
    tabindex="0"
    autofocus="autofocus"
    >
    <img
        class="${POPOUTIMAGE_CONTAINER_CLASS}"
        ${onloadhandler}
        src="${imgHref}"
    />
    <div id="imgZoomControls">
    <button id="imgZoomMinus">-</button>
    <button id="imgZoomReset">0</button>
    <button id="imgZoomPlus">+</button>
    </div>
    <button id="imgZoomClose">X</button>
</div>`;

    // ${win.document.documentElement.classList.contains(ROOT_CLASS_FIXED_LAYOUT) ?
    //     "style=\"transform-origin: 0px 0px;transform: scale(var(--r2_fxl_scale));\"" :
    //     ""}

    const val = ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable();

    // HACKY!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // if (!(win as any).readiumClosePopupDialogs) {
    //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     (win as any).readiumClosePopupDialogs = () => { closePopupDialogs(win.document); };
    // }

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
