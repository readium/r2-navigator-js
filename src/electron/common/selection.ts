// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://developer.mozilla.org/en-US/docs/Web/API/Selection
// https://developer.mozilla.org/en-US/docs/Web/API/Range

// A serializable mapping with DOM Range
// (simply encodes a CSS Selector for element, and if text node, then encodes its parent element)
export interface IRangeInfo {
    // always references an element,
    // either Range.startContainer if its nodeType == Node.ELEMENT_NODE
    // or Range.startContainer.parentElement if Range.startContainer.nodeType == Node.TEXT_NODE
    startContainerElementCssSelector: string;

    // if i == -1, Range.startContainer is the above element
    // if i >=0 and i < element.childNodes.length, Range.startContainer is the above element.childNodes[i]
    // and element.childNodes[i].nodeType == Node.TEXT_NODE
    startContainerChildTextNodeIndex: number;

    // if Range.startContainer.nodeType == Node.TEXT_NODE
    // then if j >=0 and j < Range.startContainer.data.length, Range.startContainer.data[j] is the first char,
    // or if j >= Range.startContainer.data.length, the Range starts after the text but before the text node ends
    //
    // if Range.startContainer.nodeType == Node.ELEMENT_NODE
    // then if j >=0 and j < Range.startContainer.childNodes.length,
    // Range.startContainer.childNodes[j] is the first node inclusive of the range,
    // and if j >= Range.startContainer.childNodes.length, the Range starts after the last node,
    /// but before the parent contents ends
    startOffset: number;

    endContainerElementCssSelector: string;
    endContainerChildTextNodeIndex: number;
    endOffset: number;

    cfi: string | undefined;
}

export interface ISelectionInfo {
    rangeInfo: IRangeInfo;
    cleanText: string;
    rawText: string;
}
