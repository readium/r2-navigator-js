// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md
//
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/ReadiumCSS-user_variables.css
//
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS19-api.md#user-settings

export interface IReadiumCSS {
    paged: boolean;
    colCount: string;

    textAlign: string;

    lineHeight: string;
    letterSpacing: string;
    wordSpacing: string;

    pageMargins: string;

    paraIndent: string;
    paraSpacing: string;

    bodyHyphens: string;

    backgroundColor: string;
    textColor: string;

    ligatures: string;

    font: string;
    fontSize: string;
    typeScale: string;

    darken: boolean;
    invert: boolean;

    night: boolean;
    sepia: boolean;

    a11yNormalize: boolean;
}
