// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

export const ROOT_CLASS_NO_FOOTNOTES = "r2-no-popup-foonotes";
export const POPUP_DIALOG_CLASS = "r2-popup-dialog";
export const FOOTNOTES_CONTAINER_CLASS = "r2-footnote-container";

// 'a' element: noteref biblioref glossref annoref
//
// @namespace epub "http://www.idpf.org/2007/ops";
// [epub|type~="footnote"]
// VS.
// *[epub\\:type~="footnote"]
//
// :root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="biblioentry"],
// :root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="annotation"]
export const footnotesCssStyles = `
@namespace epub "http://www.idpf.org/2007/ops";

:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="footnote"],
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="note"],
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="endnote"],
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="rearnote"] {
    display: none;
}

:root.${POPUP_DIALOG_CLASS} {
    overflow: hidden !important;
}

dialog.${POPUP_DIALOG_CLASS}::backdrop {
    background-color: rgba(0, 0, 0, 0.3);
}
dialog.${POPUP_DIALOG_CLASS} {
    z-index: 3;

    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    max-height: 400px;
    max-width: 600px;

    margin: 0;
    padding: 1em;

    border-radius: 6px;
    border-width: 2px;

    background-color: white;
    border-color: black;

    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
}

.${FOOTNOTES_CONTAINER_CLASS} {
    overflow: auto;

    max-height: 350px;

    padding: 0;
    margin: 0;
}
:root[style*="readium-night-on"] dialog.${POPUP_DIALOG_CLASS}::backdrop {
    background-color: rgba(0, 0, 0, 0.65) !important;
}
:root[style*="readium-night-on"] dialog.${POPUP_DIALOG_CLASS} {
    background-color: #333333 !important;
    border-color: white !important;
}
`;

export const TTS_ID_ACTIVE_WORD = "r2-tts-active-word";
export const TTS_ID_CONTAINER = "r2-tts-txt";
export const ttsCssStyles = `
/*
outline-color: magenta;
outline-style: solid;
outline-width: 2px;
outline-offset: 1px;
*/
#${TTS_ID_CONTAINER} {
    color: #aaaaaa;

    overflow: auto;

    max-height: 350px;

    padding: 0;
    margin: 0;

    padding-right: 1em;
}
#${TTS_ID_ACTIVE_WORD}  {
    color: black;
    text-decoration: underline;

    padding: 0;
    margin: 0;
}
:root[style*="readium-night-on"] #${TTS_ID_CONTAINER} {
    color: #bbbbbb !important;
}
:root[style*="readium-night-on"] #${TTS_ID_ACTIVE_WORD} {
    color: white !important;
    text-decoration: underline;
}
`;

export const ROOT_CLASS_INVISIBLE_MASK = "r2-visibility-mask";
export const visibilityMaskCssStyles = `
*.${ROOT_CLASS_INVISIBLE_MASK} {
    visibility: hidden !important;
}
`;

export const ROOT_CLASS_KEYBOARD_INTERACT = "r2-keyboard-interact";
export const focusCssStyles = `
@keyframes readium2ElectronAnimation_FOCUS {
    0% {
    }
    100% {
        outline: inherit;
    }
}
*:focus {
    outline-color: blue !important;
    outline-style: solid !important;
    outline-width: 2px !important;
    outline-offset: 2px !important;
}
:root:not(.${ROOT_CLASS_KEYBOARD_INTERACT}) *:focus {
    animation-name: readium2ElectronAnimation_FOCUS;
    animation-duration: 3s;
    animation-delay: 1s;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
}
*.r2-no-focus-outline:focus {
    outline: inherit !important;
}
`;

export const targetCssStyles = `
@keyframes readium2ElectronAnimation_TARGET {
    0% {
    }
    100% {
        outline: inherit;
    }
}
*:target {
    outline-color: green !important;
    outline-style: solid !important;
    outline-width: 2px !important;
    outline-offset: 2px !important;

    animation-name: readium2ElectronAnimation_TARGET;
    animation-duration: 3s;
    animation-delay: 1s;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
}
*.r2-no-target-outline:target {
    outline: inherit !important;
}
`;

export const selectionCssStyles = `
::selection {
background-color: rgb(155, 179, 240) !important;
color: black !important;
}

:root[style*="readium-night-on"] ::selection {
background-color: rgb(100, 122, 177) !important;
color: white !important;
}
/*
.readium2-hash {
    color: black !important;
    background-color: rgb(185, 207, 255) !important;
}
:root[style*="readium-night-on"] .readium2-hash {
    color: white !important;
    background-color: rgb(67, 64, 125) !important;
}
*/
`;

export const scrollBarCssStyles = `
::-webkit-scrollbar-button {
height: 0px !important;
width: 0px !important;
}

::-webkit-scrollbar-corner {
background: transparent !important;
}

/*::-webkit-scrollbar-track-piece {
background-color: red;
} */

::-webkit-scrollbar {
width:  14px;
height: 14px;
}

::-webkit-scrollbar-thumb {
background: #727272;
background-clip: padding-box !important;
border: 3px solid transparent !important;
border-radius: 30px;
}

::-webkit-scrollbar-thumb:hover {
background: #4d4d4d;
}

::-webkit-scrollbar-track {
box-shadow: inset 0 0 3px rgba(40, 40, 40, 0.2);
background: #dddddd;
box-sizing: content-box;
}

::-webkit-scrollbar-track:horizontal {
border-top: 1px solid silver;
}
::-webkit-scrollbar-track:vertical {
border-left: 1px solid silver;
}

:root[style*="readium-night-on"] ::-webkit-scrollbar-thumb {
background: #a4a4a4;
border: 3px solid #545454;
}

:root[style*="readium-night-on"] ::-webkit-scrollbar-thumb:hover {
background: #dedede;
}

:root[style*="readium-night-on"] ::-webkit-scrollbar-track {
background: #545454;
}

:root[style*="readium-night-on"] ::-webkit-scrollbar-track:horizontal {
border-top: 1px solid black;
}
:root[style*="readium-night-on"] ::-webkit-scrollbar-track:vertical {
border-left: 1px solid black;
}`;

export const readPosCssStylesAttr1 = "data-readium2-read-pos1";
export const readPosCssStylesAttr2 = "data-readium2-read-pos2";
export const readPosCssStylesAttr3 = "data-readium2-read-pos3";
export const readPosCssStylesAttr4 = "data-readium2-read-pos4";
export const readPosCssStyles = `
:root[style*="readium-sepia-on"] *[${readPosCssStylesAttr1}],
:root[style*="readium-night-on"] *[${readPosCssStylesAttr1}],
*[${readPosCssStylesAttr1}] {
    color: black !important;
    background-color: magenta !important;

    outline-color: magenta !important;
    outline-style: solid !important;
    outline-width: 6px !important;
    outline-offset: 0px !important;
}
:root[style*="readium-sepia-on"] *[${readPosCssStylesAttr2}],
:root[style*="readium-night-on"] *[${readPosCssStylesAttr2}],
*[${readPosCssStylesAttr2}] {
    color: black !important;
    background-color: yellow !important;

    outline-color: yellow !important;
    outline-style: solid !important;
    outline-width: 4px !important;
    outline-offset: 0px !important;
}
:root[style*="readium-sepia-on"] *[${readPosCssStylesAttr3}],
:root[style*="readium-night-on"] *[${readPosCssStylesAttr3}],
*[${readPosCssStylesAttr3}] {
    color: black !important;
    background-color: green !important;

    outline-color: green !important;
    outline-style: solid !important;
    outline-width: 2px !important;
    outline-offset: 0px !important;
}
:root[style*="readium-sepia-on"] *[${readPosCssStylesAttr4}],
:root[style*="readium-night-on"] *[${readPosCssStylesAttr4}],
*[${readPosCssStylesAttr4}] {
    color: black !important;
    background-color: silver !important;

    outline-color: silver !important;
    outline-style: solid !important;
    outline-width: 1px !important;
    outline-offset: 0px !important;
}`;
