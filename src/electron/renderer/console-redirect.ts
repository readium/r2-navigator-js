// https://developer.chrome.com/devtools/docs/blackboxing

import * as util from "util";

// used for TypeScript typings (defaults to "debug/src/browser" when Electron renderer process)
import * as debugz from "debug";

import * as debugNode from "debug/src/node";
// import * as debugBrowser from "debug/src/browser";

const _consoleFunctionNames = ["error", "info", "log", "warn"];
if (console.debug && (typeof console.debug === "function")) {
    _consoleFunctionNames.push("debug");
}

// let logz = function(...args: any[]) {
//     // if (Function.prototype.bind) {
//     //      logz = Function.prototype.bind.call(console.log, console, "LOGz: ");
//     // } else {
//     //     logz = function(...args: any[]) {
//     //         Function.prototype.apply.call(console.log, console, args);
//     //     };
//     // }
//     logz = console.log.bind(console, "LOGz: ");
//     logz.apply(console, args);
// };

// const logz_ = console.log.bind(console, "LOGz: ");
// const logz = function(...args: any[]) {
//     logz_.apply(console, args);
// };

export function consoleRedirect(
    debugNamespace: string,
    stdout: NodeJS.WriteStream,
    stderr: NodeJS.WriteStream,
    printInOriginalConsole: boolean): () => void {

    // logz("DEBUG test LOGz");
    // debugBrowser(debugNamespace + "_TEST")("DEBUG test zzz");

    const outStream = stderr || stdout;
    let debug: debugz.IDebugger;
    if (debugNamespace && outStream) {
        debug = debugNode(debugNamespace);
        // debug.log = console.log.bind(console);
        debug.log = (...args: any[]) => {
            outStream.write(util.format.apply(util, args) + "\n");

            // const stringArgs: string[] = args.map((arg: any) => {
            //     if (typeof arg !== "undefined") {
            //         // // breakLength: 100  maxArrayLength: undefined
            //         // return util.inspect(arg,
            //         //         { showHidden: false, depth: 1000, colors: true, customInspect: true });
            //         return arg;
            //     }
            //     return "undefined";
            // });
            // outStream.write(stringArgs.join(" ") + "\n");
        };
    }

    const originalConsole = {};

    _consoleFunctionNames.forEach((consoleFunctionName) => {
        const consoleFunction = (console as any)[consoleFunctionName] as (() => void);

        (originalConsole as any)[consoleFunctionName] = consoleFunction.bind(console);

        (console as any)[consoleFunctionName] = function(...args: any[]): any {
            // [].slice.call(arguments) or Array.prototype.slice.call(arguments) or Array.from(arguments)

            if (debug) {
                debug.apply(this, args);
            } else {
                const writeStream = (consoleFunctionName === "error" || consoleFunctionName === "warn")
                    ? stderr
                    : stdout;
                if (writeStream) {
                    writeStream.write(util.format.apply(util, args) + "\n");

                    // const stringArgs: string[] = args.map((arg: any) => {
                    //     if (typeof arg !== "undefined") {
                    //         // breakLength: 100  maxArrayLength: undefined
                    //         return util.inspect(arg,
                    //                 { showHidden: false, depth: 1000, colors: true, customInspect: true });
                    //     }
                    //     return "undefined";
                    // });
                    // writeStream.write(stringArgs.join(" ") + "\n");
                }
            }

            if (printInOriginalConsole) {
                return ((originalConsole as any)[consoleFunctionName] as (() => void)).apply(this, args);
            }
        };
    });

    return () => {
        _consoleFunctionNames.forEach((consoleFunctionName) => {
            (console as any)[consoleFunctionName] = (originalConsole as any)[consoleFunctionName];
        });
    };
}
