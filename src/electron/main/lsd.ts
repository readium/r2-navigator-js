// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IDeviceIDManager } from "@r2-lcp-js/lsd/deviceid-manager";
import { lsdRenew } from "@r2-lcp-js/lsd/renew";
import { lsdReturn } from "@r2-lcp-js/lsd/return";
import { LSD } from "@r2-lcp-js/parser/epub/lsd";
import { Server } from "@r2-streamer-js/http/server";
import * as debug_ from "debug";
import * as moment from "moment";
import { JSON as TAJSON } from "ta-json-x";
const debug = debug_("r2:navigator#electron/main/lsd");

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export async function doLsdReturn(
    publicationsServer: Server,
    deviceIDManager: IDeviceIDManager,
    publicationFilePath: string): Promise<LSD> {

    const publication = publicationsServer.cachedPublication(publicationFilePath);
    if (!publication || !publication.LCP || !publication.LCP.LSD) {
        return Promise.reject("no publication LCP LSD data?!");
    }

    let returnResponseJson: any;
    try {
        returnResponseJson = await lsdReturn(publication.LCP, deviceIDManager);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    if (returnResponseJson) {
        try {
            publication.LCP.LSD = TAJSON.deserialize<LSD>(returnResponseJson, LSD);
            if (IS_DEV) {
                debug(publication.LCP.LSD);
            }
            return Promise.resolve(publication.LCP.LSD);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
    }
    return Promise.reject("doLsdReturn?!");
}

export async function doLsdRenew(
    publicationsServer: Server,
    deviceIDManager: IDeviceIDManager,
    publicationFilePath: string,
    endDateStr: string | undefined): Promise<LSD> {

    const publication = publicationsServer.cachedPublication(publicationFilePath);
    if (!publication || !publication.LCP || !publication.LCP.LSD) {
        return Promise.reject("no publication LCP LSD data?!");
    }

    const endDate = endDateStr ? moment(endDateStr).toDate() : undefined;
    let renewResponseJson: any;
    try {
        renewResponseJson = await lsdRenew(endDate, publication.LCP, deviceIDManager);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    if (renewResponseJson) {
        try {
            publication.LCP.LSD = TAJSON.deserialize<LSD>(renewResponseJson, LSD);
            if (IS_DEV) {
                debug(publication.LCP.LSD);
            }
            return Promise.resolve(publication.LCP.LSD);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
    }
    return Promise.reject("doLsdRenew?!");
}
