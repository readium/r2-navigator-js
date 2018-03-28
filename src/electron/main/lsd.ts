// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IDeviceIDManager } from "@r2-lcp-js/lsd/deviceid-manager";
import { lsdRenew } from "@r2-lcp-js/lsd/renew";
import { lsdReturn } from "@r2-lcp-js/lsd/return";
import { Server } from "@r2-streamer-js/http/server";
import * as debug_ from "debug";
import * as moment from "moment";

const debug = debug_("r2:navigator#electron/main/lsd");

export async function doLsdReturn(
    publicationsServer: Server,
    deviceIDManager: IDeviceIDManager,
    publicationFilePath: string): Promise<any> {

    const publication = publicationsServer.cachedPublication(publicationFilePath);
    if (!publication || !publication.LCP || !publication.LCP.LSDJson) {
        return Promise.reject("no publication LCP LSD data?!");
    }

    let renewResponseJson: any;
    try {
        renewResponseJson = await lsdReturn(publication.LCP.LSDJson, deviceIDManager);
        publication.LCP.LSDJson = renewResponseJson;
        return Promise.resolve(renewResponseJson);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
}

export async function doLsdRenew(
    publicationsServer: Server,
    deviceIDManager: IDeviceIDManager,
    publicationFilePath: string,
    endDateStr: string | undefined): Promise<any> {

    const publication = publicationsServer.cachedPublication(publicationFilePath);
    if (!publication || !publication.LCP || !publication.LCP.LSDJson) {
        return Promise.reject("Internal error!");
    }

    const endDate = endDateStr ? moment(endDateStr).toDate() : undefined;
    let renewResponseJson: any;
    try {
        renewResponseJson = await lsdRenew(endDate, publication.LCP.LSDJson, deviceIDManager);
        publication.LCP.LSDJson = renewResponseJson;
        return Promise.resolve(renewResponseJson);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
}
