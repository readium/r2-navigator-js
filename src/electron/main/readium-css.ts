// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as express from "express";

import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";
import { Transformers } from "@r2-shared-js/transform/transformer";
import { TransformerHTML } from "@r2-shared-js/transform/transformer-html";
import { Server } from "@r2-streamer-js/http/server";

import { IEventPayload_R2_EVENT_READIUMCSS } from "../common/events";
import { transformHTML } from "../common/readium-css-inject";
import { READIUM_CSS_URL_PATH } from "../common/readium-css-settings";

function isFixedLayout(publication: Publication, link: Link | undefined): boolean {
    if (link && link.Properties) {
        if (link.Properties.Layout === "fixed") {
            return true;
        }
        if (typeof link.Properties.Layout !== "undefined") {
            return false;
        }
    }
    if (publication &&
        publication.Metadata &&
        publication.Metadata.Rendition) {
        return publication.Metadata.Rendition.Layout === "fixed";
    }
    return false;
}

export function setupReadiumCSS(
    server: Server, folderPath: string,
    readiumCssGetter: (publication: Publication, link: Link) => IEventPayload_R2_EVENT_READIUMCSS) {

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

    if (readiumCssGetter) {
        const transformer = (publication: Publication, link: Link, str: string): string => {

            // import * as mime from "mime-types";
            let mediaType = "application/xhtml+xml"; // mime.lookup(link.Href);
            if (link && link.TypeLink) {
                mediaType = link.TypeLink;
            }

            const readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS =
                isFixedLayout(publication, link) ?
                { setCSS: undefined, isFixedLayout: true } :
                readiumCssGetter(publication, link);
            if (readiumcssJson) {
                readiumcssJson.urlRoot = server.serverUrl();
                return transformHTML(str, readiumcssJson, mediaType);
            } else {
                return str;
            }
        };
        Transformers.instance().add(new TransformerHTML(transformer));
    }
}
