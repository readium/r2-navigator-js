// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

export const focusCssStyles = `
*:focus {
outline-style: solid !important;
outline-width: 2px !important;
outline-color: blue !important;
outline-offset: 0px !important;
}
*.no-focus-outline:focus {
outline-style: none !important;
}
`;

export const targetCssStyles = `
*:target {
outline-style: solid !important;
outline-width: 2px !important;
outline-color: magenta !important;
outline-offset: 0px !important;
}
*.no-target-outline:target {
outline-style: none !important;
}
`;

export const selectionCssStyles = `
::selection {
background-color: rgb(155, 179, 240) !important;
color: black !important;
}

:root.mdc-theme--dark ::selection {
background-color: rgb(100, 122, 177) !important;
color: white !important;
}
/*
.readium2-hash {
    color: black !important;
    background-color: rgb(185, 207, 255) !important;
}
:root.mdc-theme--dark .readium2-hash {
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

:root.mdc-theme--dark ::-webkit-scrollbar-thumb {
background: #a4a4a4;
border: 3px solid #545454;
}

:root.mdc-theme--dark ::-webkit-scrollbar-thumb:hover {
background: #dedede;
}

:root.mdc-theme--dark ::-webkit-scrollbar-track {
background: #545454;
}

:root.mdc-theme--dark ::-webkit-scrollbar-track:horizontal {
border-top: 1px solid black;
}
:root.mdc-theme--dark ::-webkit-scrollbar-track:vertical {
border-left: 1px solid black;
}`;

export const readPosCssStyles = `
:root[style*="readium-sepia-on"] .readium2-read-pos,
:root[style*="readium-night-on"] .readium2-read-pos,
.readium2-read-pos {
    color: red !important;
    background-color: silver !important;
}
:root[style*="readium-sepia-on"] .readium2-read-pos2,
:root[style*="readium-night-on"] .readium2-read-pos2,
.readium2-read-pos2 {
    color: blue !important;
    background-color: yellow !important;
}`;
