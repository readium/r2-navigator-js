import * as crypto from "crypto";

import { Server } from "@r2-streamer-js/http/server";
import * as debug_ from "debug";

const debug = debug_("r2:navigator#electron/main/lcp");

export async function doTryLcpPass(
    publicationsServer: Server,
    publicationFilePath: string,
    lcpPasses: string[],
    isSha256Hex: boolean) {

    const publication = publicationsServer.cachedPublication(publicationFilePath);
    if (!publication || !publication.LCP) {
        return Promise.reject("no publication LCP data?!");
    }

    let passesSha256Hex: string[];
    if (isSha256Hex) {
        passesSha256Hex = lcpPasses;
    } else {
        passesSha256Hex = lcpPasses.map((lcpPass) => {
            const checkSum = crypto.createHash("sha256");
            checkSum.update(lcpPass);
            const passSha256Hex = checkSum.digest("hex");
            return passSha256Hex;
            // const lcpPass64 = new Buffer(hash).toString("base64");
            // const lcpPassHex = new Buffer(lcpPass64, "base64").toString("utf8");
        });
    }

    try {
        return await publication.LCP.tryUserKeys(passesSha256Hex);
    } catch (err) {
        debug(err);
        debug("FAIL publication.LCP.tryUserKeys(): " + err);
        return Promise.reject(err);
        // DRMErrorCode (from r2-lcp-client)
        // 1 === NO CORRECT PASSPHRASE / UERKEY IN GIVEN ARRAY
        //     // No error
        //     NONE = 0,
        //     /**
        //         WARNING ERRORS > 10
        //     **/
        //     // License is out of date (check start and end date)
        //     LICENSE_OUT_OF_DATE = 11,
        //     /**
        //         CRITICAL ERRORS > 100
        //     **/
        //     // Certificate has been revoked in the CRL
        //     CERTIFICATE_REVOKED = 101,
        //     // Certificate has not been signed by CA
        //     CERTIFICATE_SIGNATURE_INVALID = 102,
        //     // License has been issued by an expired certificate
        //     LICENSE_SIGNATURE_DATE_INVALID = 111,
        //     // License signature does not match
        //     LICENSE_SIGNATURE_INVALID = 112,
        //     // The drm context is invalid
        //     CONTEXT_INVALID = 121,
        //     // Unable to decrypt encrypted content key from user key
        //     CONTENT_KEY_DECRYPT_ERROR = 131,
        //     // User key check invalid
        //     USER_KEY_CHECK_INVALID = 141,
        //     // Unable to decrypt encrypted content from content key
        //     CONTENT_DECRYPT_ERROR = 151
    }
}
