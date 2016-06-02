/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/CustomizableUI.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

const JSM = "chrome://time-tracker/content/modules/";

var TimeTracker = {
    PREF_BRANCH: "extensions.time-tracker.",
    prefs: null,

    RUNNING: 1,
    STOPPED: 0,

    redmineDomain: "",
    isRunning: false,
    currentIssue: 0,
    currentTimeEntry: 0,

    loadStyle: function(path) {
        var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        var uri = Services.io.newURI("chrome://time-tracker/" + path, null, null);
        if (!sss.sheetRegistered(uri, sss.USER_SHEET))
            sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },

    unloadStyle: function(path) {
        var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        var uri = Services.io.newURI("chrome://time-tracker/" + path, null, null);
        if (sss.sheetRegistered(uri, sss.USER_SHEET))
            sss.unregisterSheet(uri, sss.USER_SHEET);
    },

    incrementTime: function() {
        if (!TimeTracker.isRunning) {
            return;
        }

        var duration = Backend.getDuration(TimeTracker.currentTimeEntry);
        Backend.setDuration(TimeTracker.currentTimeEntry, duration + 3);

        TimeTracker.updateButtons();
        TimeTracker.timeoutID = setTimeout(TimeTracker.incrementTime, 3*1000);
    },

    updateButtons: function() {
        let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
        let enumerator = wm.getEnumerator("navigator:browser");

        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
            let node = window.document.getElementById("time-tracker");
            if (!node)
                continue;

            // State
            let cIssueId = TimeTracker.currentIssue; // Current issue (in progress)
            let tIssueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec); // Issue openned in tab
            node.setAttribute("state", TimeTracker.isRunning ? "running" : "stopped");
            node.setAttribute("issue", tIssueId === cIssueId ? "true" : "false");

            // Time
            let tIDuration = Backend.getLastPartDuration(tIssueId);
            if (tIDuration || TimeTracker.isRunning) {
                node.setAttribute("badge", (tIDuration/60/60).toFixed(2));
            }
            else {
                node.removeAttribute("badge");
            }

            if (TimeTracker.isRunning) {
                // Issue #10317 - Some title (0.12)
                let tooltip = _("Issue", cIssueId);
                let cISubject = Backend.getIssueSubject(cIssueId);
                let cIDuration = Backend.getLastPartDuration(cIssueId);
                if (cISubject) {
                    tooltip = tooltip + " - " + cISubject;
                }
                tooltip = tooltip + " (" + (cIDuration/60/60).toFixed(2) + ")";
                node.setAttribute("tooltiptext", tooltip);
            }
            else {
                node.setAttribute("tooltiptext", _("Time Tracker"));
            }
        }
    },

    getIssueByURL: function(aUrl) {
        var issueId = 0;
        var redmineDomain = TimeTracker.redmineDomain.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var re = new RegExp("^http[s]*://" + redmineDomain + "/issues/([\\d]+).*");
        if (re.test(aUrl)) {
            issueId = parseInt(re.exec(aUrl)[1]);
        }
        return issueId;
    },

    getSubjectByTitle: function(aTitle) {
        var subject = aTitle;
        var re = new RegExp("^[^:]*: (.*) - .* - .*");
        if (re.test(aTitle)) {
            subject = re.exec(aTitle)[1];
        }
        return subject;
    },

    startTracking: function(id) {
        Console.log(".startTracking(" + id + ")", "DEBUG");

        TimeTracker.currentIssue = id;
        TimeTracker.currentTimeEntry = Backend.addTimeEntry(id, Math.floor(Date.now() / 1000),
                                                            Backend.getLastPartNumber(TimeTracker.currentIssue));
        TimeTracker.isRunning = true;
        TimeTracker.timeoutID = setTimeout(TimeTracker.incrementTime, 3*1000);
    },

    stopTracking: function(id) {
        clearTimeout(TimeTracker.timeoutID);
        TimeTracker.isRunning = false;
        TimeTracker.currentIssue = 0;
    },

    /* ::::: Events ::::: */

    onClick: function(aEvent) {
        switch (aEvent.button) {
            case 0: // Left click
                break;
            case 1: // Middle click
                let window = aEvent.view;
                let issueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec);

                if (TimeTracker.isRunning && issueId === TimeTracker.currentIssue) {
                    TimeTracker.onStopTracking(aEvent);
                }
                else {
                    TimeTracker.onStartTracking(aEvent);
                }

                break;
            case 2: // Right click
                break;
        }
    },

    onStartTracking: function(aEvent) {
        var window = aEvent.view;
        var node = window.document.getElementById("time-tracker"); // aEvent.target;

        if (TimeTracker.isRunning) {
            TimeTracker.stopTracking();
        }

        var issueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec);
        var title = TimeTracker.getSubjectByTitle(window.getBrowser().contentTitle);
        Backend.updateIssue(issueId, title);
        TimeTracker.startTracking(issueId);
        TimeTracker.updateButtons();
    },

    onStopTracking: function(aEvent) {
        var window = aEvent.view;
        var node = window.document.getElementById("time-tracker"); // aEvent.target;

        if (TimeTracker.isRunning) {
            TimeTracker.stopTracking();
        }
        TimeTracker.updateButtons();
    },

    onMarkAsReported: function(aEvent) {
        var window = aEvent.view;
        var issueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec);
        var lastDuration = Backend.getLastPartDuration(issueId);
        var isRestartNeeded = (TimeTracker.isRunning && issueId === TimeTracker.currentIssue);

        if (isRestartNeeded) {
            TimeTracker.stopTracking();
        }
        Backend.addTimeEntry(issueId, Math.floor(Date.now() / 1000), Backend.getLastPartNumber(issueId)+1);
        if (isRestartNeeded && !TimeTracker.prefs.getBoolPref("mark-as-reported.stop")) {
            TimeTracker.startTracking(issueId);
        }

        // Add marked duration to #time_entry_hours entry on the page
        // Ctrl can be used to invert action
        if (TimeTracker.prefs.getBoolPref("mark-as-reported.copy-to-task") !== aEvent.ctrlKey) {
            var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Ci.nsIWindowMediator);
            var recentWindow = wm.getMostRecentWindow("navigator:browser");
            var document = recentWindow ? recentWindow.content.document : null;
            var timeEntry = document ? document.getElementById("time_entry_hours") : null;
            if (timeEntry) {
                Console.log("Set #time_entry_hours value to " + (lastDuration/60/60).toFixed(2), "DEBUG");
                timeEntry.value = (lastDuration/60/60).toFixed(2);
            }
        }

        TimeTracker.updateButtons();
    },

    onOpenIssue: function(aEvent) {
        if (aEvent.button !== 0 && aEvent.button !== 1)
            return;

        var node = aEvent.target;
        var issueId = parseInt(node.getAttribute("issue"));
        if (issueId) {
            let window = aEvent.view;

            if (TimeTracker.prefs.getBoolPref("latest-tasks.click-to-tracking") === aEvent.ctrlKey ||
                   aEvent.button === 1) { // Ctrl can be used to invert action
                let gBrowser = window.gBrowser;

                if (aEvent.button === 0) { // Left click
                    let count = gBrowser.browsers.length;
                    for (let i = 0; i < count; i++) {
                        let currentBrowser = gBrowser.getBrowserAtIndex(i);
                        let currentIssueId = TimeTracker.getIssueByURL(currentBrowser.currentURI.spec);
                        if (issueId === currentIssueId) {
                            gBrowser.selectedTab = gBrowser.tabContainer.childNodes[i];
                            return;
                        }
                    }
                }

                // !found
                gBrowser.selectedTab = gBrowser.addTab("https://" + TimeTracker.redmineDomain + "/issues/" + issueId);
            }
            else {
                if (TimeTracker.isRunning && issueId !== TimeTracker.currentIssue) {
                    TimeTracker.stopTracking();
                }

                TimeTracker.startTracking(issueId);
                TimeTracker.updateButtons();
            }
        }
        else {
            Console.log("Can't get \"issue\" attribute in onOpenIssue()", "ERROR");
        }
    },

    copyDuration: function(aEvent) {
        var window = aEvent.view;
        var issueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec);
        var duration = Backend.getLastPartDuration(issueId);

        var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Ci.nsIClipboardHelper);
        clipboard.copyString((duration/60/60).toFixed(2));
    },

    onViewShowing: function(aEvent) {
        var document = aEvent.detail.ownerDocument;
        var window = document.defaultView;
        var issueId = TimeTracker.getIssueByURL(window.getBrowser().currentURI.spec);
        var duration = Backend.getLastPartDuration(issueId);

        var tbStart = document.getElementById("panelMenu_timeTracker_start");
        if (TimeTracker.isRunning && issueId === TimeTracker.currentIssue) {
            tbStart.setAttribute("disabled", "true");
        }
        else {
            tbStart.removeAttribute("disabled");
        }

        var tbStop = document.getElementById("panelMenu_timeTracker_stop");
        if (!TimeTracker.isRunning) {
            tbStop.setAttribute("disabled", "true");
        }
        else {
            tbStop.removeAttribute("disabled");
        }

        var tbMarkAsReported = document.getElementById("panelMenu_timeTracker_MarkAsReported");
        if (duration === 0) {
            tbMarkAsReported.setAttribute("disabled", "true");
        }
        else {
            tbMarkAsReported.removeAttribute("disabled");
        }
        if (TimeTracker.prefs.getBoolPref("mark-as-reported.copy-to-task")) {
            tbMarkAsReported.setAttribute("tooltiptext", _("Mark as reported and copy duration into form on the page") + "\n" +
                                                         _("You can use Ctrl key to invert action"));
        }
        else {
            tbMarkAsReported.setAttribute("tooltiptext", _("Mark as reported") + "\n" +
                                                         _("You can use Ctrl key to invert action"));
        }

        var tbMarkAsReported = document.getElementById("panelMenu_timeTracker_copyDuration");
        var sMarkAsReported = document.getElementById("panelMenu_timeTracker_copyDurationSeparator");
        if (TimeTracker.prefs.getBoolPref("copy-duration.show")) {
            tbMarkAsReported.removeAttribute("hidden");
            sMarkAsReported.removeAttribute("hidden");
        }
        else {
            tbMarkAsReported.setAttribute("hidden", "true");
            sMarkAsReported.setAttribute("hidden", "true");
        }

        /* ::::: ::::: */
        var vbIssues = document.getElementById("panelMenu_timeTracker_historyIssues");
        // Clear previous issues items.
        while (vbIssues.firstChild) {
            vbIssues.removeChild(vbIssues.firstChild);
        }

        var issues = Backend.getIssues(TimeTracker.prefs.getIntPref("latest-tasks.count"));

        if (issues.length > 0) {
            let separator = document.createElement("menuseparator");
            vbIssues.appendChild(separator);
        }
        
        for (let i = 0; i < issues.length; i++) {
            var tb = document.createElement("toolbarbutton");

            tb.setAttribute("class", "subviewbutton");
            tb.setAttribute("label", "#" + issues[i]["id"] + ": " + issues[i]["subject"]);
            tb.setAttribute("issue", issues[i]["id"]);

            // Tooltip:
            // Task #1000 (0.1, total: 0.5)
            // Task title
            let lDuration = Backend.getLastPartDuration(issues[i]["id"]);
            let tDuration = Backend.getTotalDuration(issues[i]["id"]);
            let tooltip = _("Issue", issues[i]["id"]);
            tooltip = tooltip + " (" + (lDuration/60/60).toFixed(2);
            if (lDuration != tDuration) {
                tooltip = tooltip + ", " + _("total", (tDuration/60/60).toFixed(2));
            }
            tooltip = tooltip + ")";
            if (issues[i]["subject"]) {
                tooltip = tooltip + "\n" + issues[i]["subject"];
            }
            tb.setAttribute("tooltiptext", tooltip);

            // Indicate current task
            if (TimeTracker.currentIssue === issues[i]["id"]) {
                tb.setAttribute("checked", "true");
            }
            
            tb.addEventListener("click", TimeTracker.onOpenIssue, false);

            vbIssues.appendChild(tb);
        }
    },

    onViewHiding: function(aEvent) {
    },

    onSelectTab: function(aEvent) {
        // https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Tabbed_browser
        TimeTracker.updateButtons();
    },

    onOpenWindow: function(aWindow) {
        if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
            TimeTracker.addTabsEventListener(aWindow);
            TimeTracker.addUI(aWindow);
        }
    },

    addUI: function(aWindow) {
        var document = aWindow.document;
        var panel = document.createElement("panelview");
        var label = document.createElement("label");
        var vbox = document.createElement("vbox");
        var vbox2 = document.createElement("vbox");
        var tb = document.createElement("toolbarbutton");
        var tb2 = document.createElement("toolbarbutton");
        var tb3 = document.createElement("toolbarbutton");
        var tb4 = document.createElement("toolbarbutton");
        var separator = document.createElement("menuseparator");

        panel.setAttribute("id", "PanelUI-time-tracker");

        label.setAttribute("value", _("Time Tracker"));
        label.setAttribute("class", "panel-subview-header");

        vbox.setAttribute("class", "panel-subview-body");

        tb.setAttribute("id", "panelMenu_timeTracker_start");
        tb.setAttribute("class", "subviewbutton");
        tb.setAttribute("label", _("Start tracking"));
        tb.addEventListener("command", TimeTracker.onStartTracking, false);

        tb2.setAttribute("id", "panelMenu_timeTracker_stop");
        tb2.setAttribute("class", "subviewbutton");
        tb2.setAttribute("label", _("Stop tracking"));
        tb2.addEventListener("command", TimeTracker.onStopTracking, false);

        tb3.setAttribute("id", "panelMenu_timeTracker_MarkAsReported");
        tb3.setAttribute("class", "subviewbutton");
        tb3.setAttribute("label", _("Mark as reported"));
        tb3.addEventListener("click", TimeTracker.onMarkAsReported, false);

        tb4.setAttribute("id", "panelMenu_timeTracker_copyDuration");
        tb4.setAttribute("class", "subviewbutton");
        tb4.setAttribute("label", _("Copy duration"));
        tb4.setAttribute("tooltiptext", _("Copy duration of current task to the clipboard"));
        tb4.addEventListener("command", TimeTracker.copyDuration, false);

        separator.setAttribute("id", "panelMenu_timeTracker_copyDurationSeparator");

        vbox2.setAttribute("id", "panelMenu_timeTracker_historyIssues");

        panel.appendChild(label);
        panel.appendChild(vbox);
        vbox.appendChild(tb);
        vbox.appendChild(tb2);
        vbox.appendChild(tb3);
        vbox.appendChild(separator);
        vbox.appendChild(tb4);
        vbox.appendChild(vbox2);

        var multiView = document.getElementById("PanelUI-multiView");
        multiView.appendChild(panel);
    },

    removeUI: function(aWindow) {
        var document = aWindow.document;
        var panel = document.getElementById("PanelUI-time-tracker");
        panel.parentNode.removeChild(panel);
    },

    addTabsEventListener: function(window) {
        if (typeof window.gBrowser == "undefined" || typeof window.gBrowser.tabContainer == "undefined") {
            return;
        }

        var gBrowser = window.gBrowser;
        var tabContainer = gBrowser.tabContainer;
        tabContainer.addEventListener("TabSelect", TimeTracker.onSelectTab, false);
        gBrowser.addEventListener("load", TimeTracker.onSelectTab, true);
    },

    removeTabsEventListener: function(window) {
        if (typeof window.gBrowser == "undefined" || typeof window.gBrowser.tabContainer == "undefined") {
            return;
        }

        var gBrowser = window.gBrowser;
        var tabContainer = gBrowser.tabContainer;
        tabContainer.removeEventListener("TabSelect", TimeTracker.onSelectTab);
        gBrowser.removeEventListener("load", TimeTracker.onSelectTab);
    },

    _windowListener: {
        onOpenWindow: function(window) {
            var window = window.QueryInterface(Ci.nsIInterfaceRequestor)
                               .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
            window.addEventListener("DOMContentLoaded", function onLoad() {
                window.removeEventListener("DOMContentLoaded", onLoad, false);
                TimeTracker.onOpenWindow(window);
            }, false);
        },
        onCloseWindow: function(window) {},
        onWindowTitleChange: function(window, title) {}
    },

    observe: function(subject, topic, data) {
        if (topic != "nsPref:changed")
            return;

        if (data === "domain") {
            TimeTracker.redmineDomain = TimeTracker.prefs.getCharPref("domain");
        }
    },

    _setDefaultPrefs: function() {
        var branch = Services.prefs.getDefaultBranch(TimeTracker.PREF_BRANCH);
        for (let [key, val] in Iterator(DefaultPrefs)) {
            switch (typeof val) {
                case "boolean":
                    branch.setBoolPref(key, val);
                    break;
                case "number":
                    branch.setIntPref(key, val);
                    break;
                case "string":
                    branch.setCharPref(key, val);
                    break;
            }
        }
    },

    /* ::::: Start/stop methods ::::: */

    init: function() {
        TimeTracker._setDefaultPrefs();

        TimeTracker.prefs = Cc["@mozilla.org/preferences-service;1"]
                              .getService(Ci.nsIPrefService)
                              .getBranch(TimeTracker.PREF_BRANCH);

        if (TimeTracker.prefs.getPrefType("debug") == TimeTracker.prefs.PREF_BOOL && TimeTracker.prefs.getBoolPref("debug")) {
            Console.DEBUG = true;
        }
        TimeTracker.redmineDomain = TimeTracker.prefs.getCharPref("domain");

        TimeTracker.prefs.addObserver("", TimeTracker, false);

        Backend.init();
        TimeTracker.loadStyle("skin/main.css");

        // Load into any windows
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator);
        wm.addListener(TimeTracker._windowListener);
        var enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext();
            if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
                TimeTracker.addTabsEventListener(window);
                TimeTracker.addUI(window);
            }
        }
        
        CustomizableUI.createWidget({
            id: "time-tracker",
            //type: "custom",
            type: "view",
            viewId: "PanelUI-time-tracker",
            removable: true,
            defaultArea: CustomizableUI.AREA_NAVBAR,
            label: _("Time Tracker"),
            tooltiptext: _("Time Tracker"),
            onCreated: function(aNode) {
                aNode.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional badged-button");
                aNode.addEventListener("click", TimeTracker.onClick, false);
            },
            onCommand: function(aEvent) {
            },
            onViewShowing : function (aEvent) {
                // initialize code
                TimeTracker.onViewShowing(aEvent);
            },
            onViewHiding : function (aEvent) {
                // cleanup code
                TimeTracker.onViewHiding(aEvent);
            }
        });

        TimeTracker.updateButtons();
    },

    uninit: function() {
        TimeTracker.prefs.removeObserver("", TimeTracker);

        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator);
        wm.removeListener(TimeTracker._windowListener);
        var enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext();
            TimeTracker.removeTabsEventListener(window);
            TimeTracker.removeUI(window);
        }

        clearTimeout(TimeTracker.timeoutID);
        CustomizableUI.destroyWidget("time-tracker");
        TimeTracker.unloadStyle("skin/main.css");
    }
}

function startup(data, reason) {
    Cu.import(JSM + "DefaultPrefs.jsm");
    Cu.import(JSM + "Console.jsm");
    Cu.import(JSM + "Backend.jsm");
    Cu.import(JSM + "Locale.jsm");

    // Hack for reload localization files (.properties)
    Cc["@mozilla.org/intl/stringbundle;1"]
      .getService(Ci.nsIStringBundleService)
      .flushBundles();

    TimeTracker.init();
}

function shutdown(data, reason) {
    if (reason == APP_SHUTDOWN)
        return;

    TimeTracker.uninit();

    Cu.unload(JSM + "Locale.jsm");
    Cu.unload(JSM + "Console.jsm");
    Cu.unload(JSM + "Backend.jsm");
    Cu.unload(JSM + "DefaultPrefs.jsm");
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
