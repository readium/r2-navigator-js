// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// declare module "*";

declare module "debug/src/node";
declare module "debug/src/browser";
declare module "debug/src/common";

declare module "cssesc";
declare module "css.escape";

declare module "@flatten-js/polygon-offset" {
    import {
        type Polygon,
    } from "@flatten-js/core";
    export default function offset(poly: Polygon, offset: number): Polygon;
}
