/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("chrome://time-tracker/content/modules/Backend.jsm");

var gHistoryPane = {
    _handledTypes: {},

    init: function() {
        //this._list = document.getElementById("timeEntriesView");
        
        this._totalTime = document.getElementById("totalTimeToday");
        
        this._rebuildView();
    },

    _rebuildView: function() {
        // Clear the list of entries.
        /*
        while (this._list.childNodes.length > 1)
            this._list.removeChild(this._list.lastChild);
        */

        var total_duration = Backend.getTotalDuration();
        this._totalTime.setAttribute("value", (total_duration/60/60).toFixed(2));

        /*
        // If the user is filtering the list, then only show matching types.
        if (this._filter.value)
            visibleTypes = visibleTypes.filter(this._matchesFilter, this);
        */

        /*
        for (let i=0; i<10; i++) {
            let item = document.createElement("richlistitem");
            item.setAttribute("value", i);
            item.setAttribute("issueDescription", i);
            item.setAttribute("startDescription", "test");
            item.setAttribute("durationDescription", "test");

            button = document.createElement("button");
            button.setAttribute("label", "dsadasdasdasd");
            item.appendChild(button);

            this._list.appendChild(item);
        }
        */

        /*
        for each (let visibleType in visibleTypes) {
            let item = document.createElement("richlistitem");
            item.setAttribute("type", visibleType.type);
            item.setAttribute("typeDescription", this._describeType(visibleType));
            if (visibleType.smallIcon)
                item.setAttribute("typeIcon", visibleType.smallIcon);
            item.setAttribute("actionDescription",
                            this._describePreferredAction(visibleType));

            if (!this._setIconClassForPreferredAction(visibleType, item)) {
                item.setAttribute("actionIcon",
                                  this._getIconURLForPreferredAction(visibleType));
            }

            this._list.appendChild(item);
        }
        */

        /*
        this._selectLastSelectedType();
        */
    },
}

