// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const VERBOSE = false;
const IS_DEV = VERBOSE &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// interface DOMRect extends DOMRectReadOnly {
//     height: number;
//     width: number;
//     x: number;
//     y: number;
// }
// interface ClientRect {
//     bottom: number;
//     readonly height: number;
//     left: number;
//     right: number;
//     top: number;
//     readonly width: number;
// }
export interface IRectSimple {
    height: number;
    left: number;
    top: number;
    width: number;
}
export interface IRect extends IRectSimple {
    bottom: number;
    right: number;
}

export function getClientRectsNoOverlap(
    range: Range,
    doNotMergeHorizontallyAlignedRects: boolean,
    expand?: number): IRect[] {

    const rangeClientRects = range.getClientRects(); // Array.from(range.getClientRects());
    return getClientRectsNoOverlap_(rangeClientRects, doNotMergeHorizontallyAlignedRects, expand);
}

// tslint:disable-next-line:max-line-length
export function getClientRectsNoOverlap_(
    clientRects: ClientRectList | DOMRectList,
    doNotMergeHorizontallyAlignedRects: boolean,
    expand?: number): IRect[] {

    const originalRects: IRect[] = [];
    for (const rangeClientRect of clientRects) {
        originalRects.push({
            bottom: rangeClientRect.bottom,
            height: rangeClientRect.height,
            left: rangeClientRect.left,
            right: rangeClientRect.right,
            top: rangeClientRect.top,
            width: rangeClientRect.width,
        });
    }
    return getClientRectsNoOverlap__(originalRects, doNotMergeHorizontallyAlignedRects, expand);
}

// tslint:disable-next-line:max-line-length
export function getClientRectsNoOverlap__(
    originalRects: IRect[],
    doNotMergeHorizontallyAlignedRects: boolean,
    expand?: number): IRect[] {

    const ex = expand ? expand : 0;
    if (ex) {
        for (const rect of originalRects) {
            rect.left -= ex;
            rect.top -= ex;
            rect.right += ex;
            rect.bottom += ex;
            rect.width += (2 * ex);
            rect.height += (2 * ex);
        }
    }

    const tolerance = 1;

    const mergedRects = mergeTouchingRects(originalRects, tolerance, doNotMergeHorizontallyAlignedRects);
    const noContainedRects = removeContainedRects(mergedRects, tolerance);
    const newRects = replaceOverlapingRects(noContainedRects);

    const minArea = 2 * 2;
    for (let j = newRects.length - 1; j >= 0; j--) {
        const rect = newRects[j];
        let bigEnough = (rect.width * rect.height) > minArea;
        if (bigEnough && ex && (rect.width <= ex || rect.height <= ex)) {
            bigEnough = false;
        }
        if (!bigEnough) {
            if (newRects.length > 1) {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove small");
                }
                newRects.splice(j, 1);
            } else {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove small, but keep otherwise empty!");
                }
                break;
            }
        }
    }

    if (IS_DEV) {
        checkOverlaps(newRects);
    }

    if (IS_DEV) {
        console.log(`CLIENT RECT: reduced ${originalRects.length} --> ${newRects.length}`);
    }
    return newRects;
}

// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/rect-helpers.js
// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/tappable-rects.js
function almostEqual(a: number, b: number, tolerance: number) {
    return Math.abs(a - b) <= tolerance;
}

export function rectIntersect(rect1: IRect, rect2: IRect): IRect {
    const maxLeft = Math.max(rect1.left, rect2.left);
    const minRight = Math.min(rect1.right, rect2.right);
    const maxTop = Math.max(rect1.top, rect2.top);
    const minBottom = Math.min(rect1.bottom, rect2.bottom);
    const rect: IRect = {
        bottom: minBottom,
        height: Math.max(0, minBottom - maxTop),
        left: maxLeft,
        right: minRight,
        top: maxTop,
        width: Math.max(0, minRight - maxLeft),
    };
    return rect;
}

// rect1 - rect2
export function rectSubtract(rect1: IRect, rect2: IRect): IRect[] {

    const rectIntersected = rectIntersect(rect2, rect1);
    if (rectIntersected.height === 0 || rectIntersected.width === 0) {
    // if (rectIntersected.left >= rectIntersected.right || rectIntersected.top >= rectIntersected.bottom) {
        return [rect1];
    }

    const rects: IRect[] = [];

    {
        // left strip
        const rectA: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rect1.left,
            right: rectIntersected.left,
            top: rect1.top,
            width: 0,
        };
        rectA.width = rectA.right - rectA.left;
        rectA.height = rectA.bottom - rectA.top;
        if (rectA.height !== 0 && rectA.width !== 0) {
        // if (rectA.left < rectA.right && rectA.top < rectA.bottom) {
            rects.push(rectA);
        }
    }

    {
        // inside strip
        const rectB: IRect = {
            bottom: rectIntersected.top,
            height: 0,
            left: rectIntersected.left,
            right: rectIntersected.right,
            top: rect1.top,
            width: 0,
        };
        rectB.width = rectB.right - rectB.left;
        rectB.height = rectB.bottom - rectB.top;
        if (rectB.height !== 0 && rectB.width !== 0) {
        // if (rectB.left < rectB.right && rectB.top < rectB.bottom) {
            rects.push(rectB);
        }
    }

    {
        // inside strip
        const rectC: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rectIntersected.left,
            right: rectIntersected.right,
            top: rectIntersected.bottom,
            width: 0,
        };
        rectC.width = rectC.right - rectC.left;
        rectC.height = rectC.bottom - rectC.top;
        if (rectC.height !== 0 && rectC.width !== 0) {
        // if (rectC.left < rectC.right && rectC.top < rectC.bottom) {
            rects.push(rectC);
        }
    }

    {
        // right strip
        const rectD: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rectIntersected.right,
            right: rect1.right,
            top: rect1.top,
            width: 0,
        };
        rectD.width = rectD.right - rectD.left;
        rectD.height = rectD.bottom - rectD.top;
        if (rectD.height !== 0 && rectD.width !== 0) {
        // if (rectD.left < rectD.right && rectD.top < rectD.bottom) {
            rects.push(rectD);
        }
    }

    return rects;
}

export function rectContainsPoint(rect: IRect, x: number, y: number, tolerance: number) {
    return (rect.left < x || almostEqual(rect.left, x, tolerance)) &&
        (rect.right > x || almostEqual(rect.right, x, tolerance)) &&
        (rect.top < y || almostEqual(rect.top, y, tolerance)) &&
        (rect.bottom > y || almostEqual(rect.bottom, y, tolerance));
}

export function rectContains(rect1: IRect, rect2: IRect, tolerance: number) {
    return (
        rectContainsPoint(rect1, rect2.left, rect2.top, tolerance) && // top left corner
        rectContainsPoint(rect1, rect2.right, rect2.top, tolerance) && // top right corner
        rectContainsPoint(rect1, rect2.left, rect2.bottom, tolerance) && // bottom left corner
        rectContainsPoint(rect1, rect2.right, rect2.bottom, tolerance) // bottom right corner
    );
}

export function getBoundingRect(rect1: IRect, rect2: IRect): IRect {
    const left = Math.min(rect1.left, rect2.left);
    const right = Math.max(rect1.right, rect2.right);
    const top = Math.min(rect1.top, rect2.top);
    const bottom = Math.max(rect1.bottom, rect2.bottom);
    return {
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left,
    };
}

export function rectsTouchOrOverlap(rect1: IRect, rect2: IRect, tolerance: number) {
    return (
        (rect1.left < rect2.right || (tolerance >= 0 && almostEqual(rect1.left, rect2.right, tolerance))) &&
        (rect2.left < rect1.right || (tolerance >= 0 && almostEqual(rect2.left, rect1.right, tolerance))) &&
        (rect1.top < rect2.bottom || (tolerance >= 0 && almostEqual(rect1.top, rect2.bottom, tolerance))) &&
        (rect2.top < rect1.bottom || (tolerance >= 0 && almostEqual(rect2.top, rect1.bottom, tolerance)))
    );
}

// tslint:disable-next-line:max-line-length
export function mergeTouchingRects(rects: IRect[], tolerance: number, doNotMergeHorizontallyAlignedRects: boolean): IRect[] {
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const rect1 = rects[i];
            const rect2 = rects[j];
            if (rect1 === rect2) {
                if (IS_DEV) {
                    console.log("mergeTouchingRects rect1 === rect2 ??!");
                }
                continue;
            }

            const rectsLineUpVertically =
                almostEqual(rect1.top, rect2.top, tolerance) &&
                almostEqual(rect1.bottom, rect2.bottom, tolerance);

            const rectsLineUpHorizontally =
                almostEqual(rect1.left, rect2.left, tolerance) &&
                almostEqual(rect1.right, rect2.right, tolerance);

            const horizontalAllowed = !doNotMergeHorizontallyAlignedRects;
            // tslint:disable-next-line:max-line-length
            const aligned = (rectsLineUpHorizontally && horizontalAllowed) || (rectsLineUpVertically && !rectsLineUpHorizontally);

            const canMerge = aligned && rectsTouchOrOverlap(rect1, rect2, tolerance);

            if (canMerge) {
                if (IS_DEV) {
                    // tslint:disable-next-line:max-line-length
                    console.log(`CLIENT RECT: merging two into one, VERTICAL: ${rectsLineUpVertically} HORIZONTAL: ${rectsLineUpHorizontally} (${doNotMergeHorizontallyAlignedRects})`);
                }
                const newRects = rects.filter((rect) => {
                    return rect !== rect1 && rect !== rect2;
                });
                const replacementClientRect = getBoundingRect(rect1, rect2);
                newRects.push(replacementClientRect);

                return mergeTouchingRects(newRects, tolerance, doNotMergeHorizontallyAlignedRects);
            }
        }
    }

    return rects;
}

export function replaceOverlapingRects(rects: IRect[]): IRect[] {
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const rect1 = rects[i];
            const rect2 = rects[j];
            if (rect1 === rect2) {
                if (IS_DEV) {
                    console.log("replaceOverlapingRects rect1 === rect2 ??!");
                }
                continue;
            }

            if (rectsTouchOrOverlap(rect1, rect2, -1)) { // negative tolerance for strict overlap test

                let toAdd: IRect[] = [];
                let toRemove: IRect;
                let toPreserve: IRect;

                // rect1 - rect2
                const subtractRects1 = rectSubtract(rect1, rect2); // discard #1, keep #2, add returned rects
                if (subtractRects1.length === 1) {
                    toAdd = subtractRects1;
                    toRemove = rect1;
                    toPreserve = rect2;
                } else {
                    // rect2 - rect1
                    const subtractRects2 = rectSubtract(rect2, rect1); // discard #2, keep #1, add returned rects
                    if (subtractRects1.length < subtractRects2.length) {
                        toAdd = subtractRects1;
                        toRemove = rect1;
                        toPreserve = rect2;
                    } else {
                        toAdd = subtractRects2;
                        toRemove = rect2;
                        toPreserve = rect1;
                    }
                }

                if (IS_DEV) {
                    const toCheck = [];
                    toCheck.push(toPreserve);
                    Array.prototype.push.apply(toCheck, toAdd);
                    checkOverlaps(toCheck);
                }

                if (IS_DEV) {
                    console.log(`CLIENT RECT: overlap, cut one rect into ${toAdd.length}`);
                }
                const newRects = rects.filter((rect) => {
                    return rect !== toRemove;
                });
                Array.prototype.push.apply(newRects, toAdd);

                return replaceOverlapingRects(newRects);
            }
        }
    }

    return rects;
}

export function getRectOverlapX(rect1: IRect, rect2: IRect) {
    return Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
}

export function getRectOverlapY(rect1: IRect, rect2: IRect) {
    return Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
}

export function removeContainedRects(rects: IRect[], tolerance: number): IRect[] {

    const rectsToKeep = new Set(rects);

    for (const rect of rects) {
        const bigEnough = rect.width > 1 && rect.height > 1;
        if (!bigEnough) {
            if (IS_DEV) {
                console.log("CLIENT RECT: remove tiny");
            }
            rectsToKeep.delete(rect);
            continue;
        }
        for (const possiblyContainingRect of rects) {
            if (rect === possiblyContainingRect) {
                continue;
            }
            if (!rectsToKeep.has(possiblyContainingRect)) {
                continue;
            }
            if (rectContains(possiblyContainingRect, rect, tolerance)) {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove contained");
                }
                rectsToKeep.delete(rect);
                break;
            }
        }
    }

    return Array.from(rectsToKeep);
}

export function checkOverlaps(rects: IRect[]) {

    const stillOverlapingRects: IRect[] = [];

    for (const rect1 of rects) {
        for (const rect2 of rects) {
            if (rect1 === rect2) {
                continue;
            }
            const has1 = stillOverlapingRects.indexOf(rect1) >= 0;
            const has2 = stillOverlapingRects.indexOf(rect2) >= 0;
            if (!has1 || !has2) {
                if (rectsTouchOrOverlap(rect1, rect2, -1)) { // negative tolerance for strict overlap test

                    if (!has1) {
                        stillOverlapingRects.push(rect1);
                    }
                    if (!has2) {
                        stillOverlapingRects.push(rect2);
                    }

                    console.log("CLIENT RECT: overlap ---");
                    // tslint:disable-next-line:max-line-length
                    console.log(`#1 TOP:${rect1.top} BOTTOM:${rect1.bottom} LEFT:${rect1.left} RIGHT:${rect1.right} WIDTH:${rect1.width} HEIGHT:${rect1.height}`);
                    // tslint:disable-next-line:max-line-length
                    console.log(`#2 TOP:${rect2.top} BOTTOM:${rect2.bottom} LEFT:${rect2.left} RIGHT:${rect2.right} WIDTH:${rect2.width} HEIGHT:${rect2.height}`);

                    const xOverlap = getRectOverlapX(rect1, rect2);
                    console.log(`xOverlap: ${xOverlap}`);

                    const yOverlap = getRectOverlapY(rect1, rect2);
                    console.log(`yOverlap: ${yOverlap}`);
                }
            }
        }
    }
    if (stillOverlapingRects.length) {
        console.log(`CLIENT RECT: overlaps ${stillOverlapingRects.length}`);
        // for (const rect of stillOverlapingRects) {
        // tslint:disable-next-line:max-line-length
        //     console.log(`CLIENT RECT: remaining overlaps TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);
        // }
    }
}

// https://github.com/edg2s/rangefix/blob/master/rangefix.js
// function checkRangeFix(documant: Document) {

//     const p = documant.createElement("p");
//     const span = documant.createElement("span");
//     const t1 = documant.createTextNode("aa");
//     const t2 = documant.createTextNode("aa");
//     const img = documant.createElement("img");
//     img.setAttribute("src", "#null");
//     p.appendChild(t1);
//     p.appendChild(span);
//     span.appendChild(img);
//     span.appendChild(t2);
//     documant.body.appendChild( p );

//     const range = new Range(); // documant.createRange();
//     range.setStart(t1, 1);
//     range.setEnd(span, 0);

//     let getBoundingClientRect = range.getClientRects().length > 1;
//     let getClientRects = getBoundingClientRect;
//     console.log("BUG 1: " + getClientRects);

//     if (!getClientRects) {
//         range.setEnd(t2, 1);
//         getBoundingClientRect = range.getClientRects().length === 2;
//         getClientRects = getBoundingClientRect;
//         console.log("BUG 2: " + getClientRects);
//     }

//     if (!getBoundingClientRect) {
//         // Safari doesn't return a valid bounding rect for collapsed ranges
//         // Equivalent to range.collapse( true ) which isn't well supported
//         range.setEnd(range.startContainer, range.startOffset);
//         const boundingRect = range.getBoundingClientRect();
//         getBoundingClientRect = boundingRect.top === 0 && boundingRect.left === 0;
//         console.log("BUG 3: " + getBoundingClientRect);
//     }

//     documant.body.removeChild(p);
// }

// function getClientRectsFix(range: Range): ClientRect[] | DOMRect[] {

//     const rects: ClientRect[] | DOMRect[] = [];

//     let endContainer: Node | null = range.endContainer;
//     let endOffset: number = range.endOffset;
//     let partialRange = new Range();

//     while (endContainer && endContainer !== range.commonAncestorContainer) {
//         partialRange.setStart(endContainer, 0);
//         partialRange.setEnd(endContainer, endOffset);

//         Array.prototype.push.apply(rects, partialRange.getClientRects());

//         const parentNode: Node | null = endContainer.parentNode;
//         if (parentNode) {
//             endOffset = Array.prototype.indexOf.call(parentNode.childNodes, endContainer);
//         }
//         endContainer = parentNode;
//     }

//     if (endContainer) {
//         partialRange = range.cloneRange();
//         partialRange.setEnd(endContainer, endOffset);
//         Array.prototype.push.apply(rects, partialRange.getClientRects());
//     }

//     return rects;
// }

// function getBoundingClientRectFix(range: Range): ClientRect | DOMRect | undefined {

//     const rects = getClientRectsFix(range);
//     if (rects.length === 0) {
//         return undefined;
//     }

//     const nativeBoundingRect = range.getBoundingClientRect();
//     if (nativeBoundingRect.width === 0 && nativeBoundingRect.height === 0) {
//         return rects[0];
//     }

//     let boundingRect: ClientRect | undefined;

//     for (const rect of rects) {
//         if (!boundingRect) {
//             boundingRect = {
//                 bottom: rect.bottom,
//                 height: rect.bottom - rect.top,
//                 left: rect.left,
//                 right: rect.right,
//                 top: rect.top,
//                 width: rect.right - rect.left,
//             };
//         } else {
//             boundingRect.left = Math.min(boundingRect.left, rect.left);
//             boundingRect.top = Math.min(boundingRect.top, rect.top);
//             boundingRect.right = Math.max(boundingRect.right, rect.right);
//             boundingRect.bottom = Math.max(boundingRect.bottom, rect.bottom);
//             (boundingRect as any).width = boundingRect.right - boundingRect.left;
//             (boundingRect as any).height = boundingRect.bottom - boundingRect.top;
//         }
//     }

//     return boundingRect;
// }
