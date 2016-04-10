/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

var EXPORTED_SYMBOLS = ["_"];

Cu.import("chrome://time-tracker/content/modules/Console.jsm");

var _ = function(key, sub) {
    var bundle = Cc["@mozilla.org/intl/stringbundle;1"]
                   .getService(Ci.nsIStringBundleService)
                   .createBundle("chrome://time-tracker/locale/main.properties");

    var localized = '';
    try {
        localized = bundle.GetStringFromName(key);
    } catch(e) {
        Console.log("Can't get localized string \"" + key + "\"", "WARNING")
    }
    return localized.replace(/%(\d*)(s|d)/g, sub);
}
