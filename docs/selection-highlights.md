# Technical implementation of text / document selections and highlights

## Selections

### DOM selection

A good starting point is to listen for user "selection" events in the DOM tree, such as `selectionstart`:

```javascript
win.document.addEventListener("selectionstart", (evt) => {
    // ...
});
```

Note: there are instances where the `selectionstart` event is not raised. Not sure why.

Note: the `selectionchange` event may be problematic in cases where the DOM selection API is used programmatically as a post-processing step, in order to normalize multiple selections to a single range, as this can potentially cause duplicate events and infinite loops. Code example:

```javascript
win.document.addEventListener("selectionchange", (evt) => {
    
    const selection = window.getSelection();
    if (selection) {
        const range = NORMALIZE_TO_SINGLE_RANGE(...);
        selection.removeAllRanges(); // => triggers selectionchange again!
        selection.addRange(range); // => triggers selectionchange again!
    }
});
```

As shown above, `selection.removeAllRanges()` can be used to clear existing user selections in the DOM. This may be useful in cases where the document viewport has shifted pass visible user selections (this is particularly relevant in "structured" paginated mode, but this logic applies to a "looser" scroll view as well). From a UX perspective, such hidden selections can be confusing, so the application may decide to void selections that disappear out of view.

Note that a selection can exist in a "collapsed" state, effectively a "cursor" with no actual content (in which case this may need to be ignored ... it depends on the consumer logic). Code example:

```javascript
const selection = window.getSelection();
if (selection) {
    if (selection.isCollapsed) {
        return;
    }
}
```

Getting the raw text from a DOM selection is easy, but it might be necessary to cleanup the text (e.g. whitespaces), and to filter-out selections that are deemed "empty". Example:

```javascript
const selection = window.getSelection();
if (selection) {
    if (selection.isCollapsed) {
        return;
    }
    const rawText = selection.toString();
    const cleanText = rawText.trim().replace(/\n/g, " ").replace(/\s\s+/g, " ");
    if (cleanText.length === 0) {
        return;
    }
}
```

DOM selections contain ranges, and should have `anchorNode` (+ `anchorOffset`) and `focusNode` (+ `focusOffset`):

```javascript
const selection = window.getSelection();
if (selection) {
    if (!selection.anchorNode || !selection.focusNode) {
        return;
    }
}
```

DOM selections can contain a single range, and multiple ranges can be normalized (ensure document ordering):

```javascript
const selection = window.getSelection();
if (selection) {
    if (!selection.anchorNode || !selection.focusNode) {
        return;
    }

    const range = selection.rangeCount === 1 ? selection.getRangeAt(0) :
        createOrderedRange(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);
    if (!range || range.collapsed) {
        return;
    }
}
```

There are multiple ways to ensure the order of selection ranges, here is an example `createOrderedRange()` function:

```javascript
function createOrderedRange(startNode, startOffset, endNode, endOffset) {

    const range = new Range(); // document.createRange()
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    if (!range.collapsed) {
        return range;
    }

    const rangeReverse = new Range(); // document.createRange()
    rangeReverse.setStart(endNode, endOffset);
    rangeReverse.setEnd(startNode, startOffset);
    if (!rangeReverse.collapsed) {
        return range;
    }

    return undefined;
}
```

At that point, we have a DOM range object. We now want to serialize it into a JSON data structure that can be used for persistent storage.

### Range serialization

The `convertRange()` function:

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/webview/selection.ts#L229-L373

...returns a `IRangeInfo` object which is a direct "translation" of the DOM range (unlike CFI which has its own indexing rules and representation conventions):

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/common/selection.ts#L13-L40

In a nutshell: CSS Selectors are used to reliably encode references to DOM elements in a web-friendly manner (i.e. not CFI). In the case of DOM text nodes, the direct parent is referenced, and the child offset is stored (zero-based integer index).

A CFI reference is also created for good measure, but this is not actually critical to the inner workings of the selection/highlight mechanisms.

Note that the `convertRange()` function takes two additional parameters (external functions) which are used to encode CSS selectors and CFI representations.

The CFI "generator" implementation is currently simplistic (elements only). Code excerpt (blacklist handling removed, for brevity):

```javascript
export const computeCFI = (node) => {

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return undefined;
    }

    let cfi = "";

    let currentElement = node;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
        const currentElementParentChildren = currentElement.parentNode.children;
        let currentElementIndex = -1;
        for (let i = 0; i < currentElementParentChildren.length; i++) {
            if (currentElement === currentElementParentChildren[i]) {
                currentElementIndex = i;
                break;
            }
        }
        if (currentElementIndex >= 0) {
            const cfiIndex = (currentElementIndex + 1) * 2;
            cfi = cfiIndex +
                (currentElement.id ? ("[" + currentElement.id + "]") : "") +
                (cfi.length ? ("/" + cfi) : "");
        }
        currentElement = currentElement.parentNode;
    }

    return "/" + cfi;
};
```

...however, there is a prototype (low development priority) CFI generator for character-level CFI range:

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/webview/selection.ts#L283-L361

The pseudo-canonical unique CSS Selectors are generated using a TypeScript port of an external library called "finder":

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/common/cssselector2.ts#L8

The original CSS Selectors algorithm was borrowed from the Chromium code, but the "finder" lib turned out to be a better choice (uniqueness is VERY important, along with the blacklisting capabilities):

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/common/cssselector.ts#L9

Naturally, range serialization must be bidirectional. Hence the `convertRangeInfo()` function which performs the reverse transformation of `convertRange()`:

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/webview/selection.ts#L375-L416

As you can see, very straight-forward reliable conversion, no CFI edge-case juggling.

## Highlights

### Client rectangles (atomic bounding boxes)

Once a DOM range is obtained (either directly from a user selection, or from a deserialized range object), the "client rectangles" (bounding boxes) can be normalized to prevent overlap (which would otherwise result in rendering artefacts due to combined opacity), and to minimize their number (which would otherwise impact performance).

The `getClientRectsNoOverlap()` implements the necessary logic:

https://github.com/readium/r2-navigator-js/blob/59c593511502eb460b8252f807a6e11dfebb952e/src/electron/renderer/common/rect-utils.ts#L35-L39

The differences are very obvious between `range.getClientRects()` and `getClientRectsNoOverlap(range)`. The former often generates many duplicates, overlaps, unnecessarily fragmented boxes, etc.

### 