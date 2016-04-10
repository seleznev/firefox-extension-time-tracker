/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

var EXPORTED_SYMBOLS = ["Console"];

Cu.import("resource://gre/modules/Services.jsm");

var Console = {
    DEBUG: true,

    error: function(message) {
        this.log(message, "ERROR");
    },
    debug: function(message) {
        this.log(message, "DEBUG");
    },
    warning: function(message) {
        this.log(message, "WARNING");
    },
    
    log: function(message, level, sourceName) {
        if (!this.DEBUG && level === "DEBUG") {
            return;
        }

        if (!sourceName) {
            //sourceName = Services.io.newURI("bootstrap.js", null, Services.io.newURI(__SCRIPT_URI_SPEC__, null, null)).spec;
            sourceName = "bootstrap.js";
        }

        var console = Cc["@mozilla.org/consoleservice;1"]
                        .getService(Ci.nsIConsoleService);

        var flag;
        switch (level) {
            case "ERROR":
                flag = 0;
                break;
            case "WARNING":
                flag = 1;
                break;
            default:
                flag = 4;
        }

        if (flag == 4) {
            console.logStringMessage("Time Traker: " + message);
        }
        else {
            let console_message = Cc["@mozilla.org/scripterror;1"]
                                    .createInstance(Ci.nsIScriptError);
            console_message.init("Time Traker: " + message, sourceName, null, null, null, flag, null);
            console.logMessage(console_message);
        }
    }

}
