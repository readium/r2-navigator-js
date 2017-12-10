import * as express from "express";
import { Server } from "r2-streamer-js/dist/es6-es2015/src/http/server";

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
        // setHeaders: function (res, path, stat) {
        //   res.set('x-timestamp', Date.now())
        // }
    };
    server.expressUse("/readium-css", express.static(folderPath, staticOptions));
}
