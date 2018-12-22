// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { webFrame } from "electron";

import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../../common/sessions";

// not needed in renderer process if fetch() is not used for READIUM2_ELECTRON_HTTP_PROTOCOL
// (instead, use https://127.0.0.1:PORT via convertCustomSchemeToHttpUrl())
export const registerProtocol = () => {
    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webframe
    // protocol.registerStandardSchemes([READIUM2_ELECTRON_HTTP_PROTOCOL], { secure: true });
    // webFrame.registerURLSchemeAsSecure(READIUM2_ELECTRON_HTTP_PROTOCOL);
    // // webFrame.registerURLSchemeAsBypassingCSP(READIUM2_ELECTRON_HTTP_PROTOCOL);
    webFrame.registerURLSchemeAsPrivileged(READIUM2_ELECTRON_HTTP_PROTOCOL, {
        allowServiceWorkers: false,
        bypassCSP: false,
        corsEnabled: true,
        secure: true,
        supportFetchAPI: true,
    });
};
