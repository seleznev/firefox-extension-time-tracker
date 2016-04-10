/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Original code:
 * browser/components/preferences/in-content/preferences.js */

"use strict";

let gLastHash = "";

addEventListener("DOMContentLoaded", function onLoad() {
    removeEventListener("DOMContentLoaded", onLoad);
    init_all();
});

function init_all() {
    gHistoryPane.init();

    let categories = document.getElementById("categories");
    categories.addEventListener("select", event => gotoPref(event.target.value));

    window.addEventListener("hashchange", onHashChange);
    gotoPref();
}

function onHashChange() {
    gotoPref();
}

function gotoPref(aCategory) {
    let categories = document.getElementById("categories");
    const kDefaultCategoryInternalName = categories.firstElementChild.value;
    let hash = document.location.hash;
    let category = aCategory || hash.substr(1) || kDefaultCategoryInternalName;
    category = friendlyPrefCategoryNameToInternalName(category);

    // Updating the hash (below) or changing the selected category
    // will re-enter gotoPref.
    if (gLastHash == category)
        return;
    let item = categories.querySelector(".category[value=" + category + "]");
    if (!item) {
        category = kDefaultCategoryInternalName;
        item = categories.querySelector(".category[value=" + category + "]");
    }

    let newHash = internalPrefCategoryNameToFriendlyName(category);
    if (gLastHash || category != kDefaultCategoryInternalName) {
        document.location.hash = newHash;
    }
    // Need to set the gLastHash before setting categories.selectedItem since
    // the categories 'select' event will re-enter the gotoPref codepath.
    gLastHash = category;
    categories.selectedItem = item;
    window.history.replaceState(category, document.title);
    search(category, "data-category");
    let mainContent = document.querySelector(".main-content");
    mainContent.scrollTop = 0;
}

function search(aQuery, aAttribute) {
    let elements = document.getElementById("mainPrefPane").children;
    for (let element of elements) {
        let attributeValue = element.getAttribute(aAttribute);
        element.hidden = (attributeValue != aQuery);
    }
}

function friendlyPrefCategoryNameToInternalName(aName) {
    if (aName.startsWith("pane"))
        return aName;
    return "pane" + aName.substring(0,1).toUpperCase() + aName.substr(1);
}

// This function is duplicated inside of utilityOverlay.js's openPreferences.
function internalPrefCategoryNameToFriendlyName(aName) {
    return (aName || "").replace(/^pane./, function(toReplace) { return toReplace[4].toLowerCase(); });
}
