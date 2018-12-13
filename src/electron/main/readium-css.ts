// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Server } from "@r2-streamer-js/http/server";
import * as express from "express";

import { READIUM_CSS_URL_PATH } from "../common/readium-css-settings";

export function setupReadiumCSS(server: Server, folderPath: string) {
    // https://expressjs.com/en/4x/api.html#express.static
    const staticOptions = {
        dotfiles: "ignore",
        etag: true,
        fallthrough: false,
        immutable: true,
        index: false,
        maxAge: "1d",
        redirect: false,
        // extensions: ["css", "otf"],
        setHeaders: (res: express.Response, _path: string, _stat: any) => {
            //   res.set('x-timestamp', Date.now())
            server.setResponseCORS(res);
        },
    };

    server.expressUse("/" + READIUM_CSS_URL_PATH, express.static(folderPath, staticOptions));
}
