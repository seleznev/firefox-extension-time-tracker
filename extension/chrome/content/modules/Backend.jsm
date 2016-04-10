/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["Backend"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

var Backend = {
    DEBUG: false,
    db: null,
    init: function() {
        this.openDB();
        /*
        CREATE TABLE IF NOT EXISTS `time_entries` (
           `id`          INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
           `issue_id`    INTEGER NOT NULL,
           `part_number` INTEGER NOT NULL DEFAULT 0,
           `time_start`  INTEGER NOT NULL,
           `duration`    INTEGER NOT NULL DEFAULT 0
        );
        */
        // FIXME
        this.db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS `time_entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `issue_id` INTEGER NOT NULL, `part_number` INTEGER NOT NULL DEFAULT 0, `time_start` INTEGER NOT NULL, `duration` INTEGER NOT NULL DEFAULT 0);");
        this.db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS `issues` (`id` INTEGER PRIMARY KEY NOT NULL, `subject` TEXT NOT NULL DEFAULT '');");
        this.closeDB();
    },

    openDB: function(db="time_tracker.sqlite") {
        if (this.db == null) {
            let db_file = FileUtils.getFile("ProfD", ["time_tracker.sqlite"]);
            this.db = Services.storage.openDatabase(db_file);
        }
    },

    closeDB: function() {
        if (this.db != null) {
            this.db.close();
            this.db = null;
        }
    },

    addTimeEntry: function(issueId, timeStart, partNumber=0) {
        this.openDB();
        /* INSERT INTO `time_entries` (`issue_id`, `time_start`) VALUES (issueId, timeStart); */
        var statement = this.db.createStatement("INSERT INTO `time_entries` (`issue_id`, `part_number`, `time_start`) VALUES (:issue_id, :part_number, :time_start);");
        statement.params.issue_id = issueId;
        statement.params.part_number = partNumber;
        statement.params.time_start = timeStart;
        try {
            statement.execute();
        }
        finally {
            statement.reset();
        }
        statement = this.db.createStatement("SELECT last_insert_rowid() AS id");
        var id = 0;
        try {
            statement.executeStep();
            id = statement.row.id;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return id;
    },

    setDuration: function(id, duration) {
        this.openDB();
        /* UPDATE `time_entries` SET `duration`=duration WHERE `id`=(SELECT MAX(`id`) FROM `time_entries` WHERE `issue_id`=issueId); */
        var statement = this.db.createStatement("UPDATE `time_entries` SET `duration`=:duration WHERE `id`=:entry_id;");
        statement.params.entry_id = id;
        statement.params.duration = duration;
        try {
            statement.execute();
        }
        finally {
            statement.reset();
        }
        this.closeDB();
    },

    getDuration: function(id) {
        this.openDB();
        var duration = 0;
        var statement = this.db.createStatement("SELECT `duration` FROM `time_entries` WHERE `id`=:entry_id;");
        statement.params.entry_id = id;
        try {
            statement.executeStep();
            duration = statement.row.duration;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return duration;
    },

    getLastPartNumber: function(issueId) {
        this.openDB();
        var part_number = 0;
        var statement = this.db.createStatement("SELECT MAX(`part_number`) AS `part_number` FROM `time_entries` WHERE `issue_id`=:issue_id;");
        statement.params.issue_id = issueId;
        try {
            statement.executeStep();
            part_number = statement.row.part_number ? statement.row.part_number : 0;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return part_number;
    },

    getLastPartDuration: function(issueId) {
        this.openDB();
        var duration = 0;
        var statement = this.db.createStatement("SELECT SUM(`duration`) AS `duration` FROM `time_entries` WHERE `issue_id`=:issue_id AND `part_number`=(SELECT MAX(`part_number`) FROM `time_entries` WHERE `issue_id`=:issue_id);");
        statement.params.issue_id = issueId;
        try {
            statement.executeStep();
            duration = statement.row.duration;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return duration;
    },

    getTotalDuration: function(issueId=null) {
        this.openDB();
        var duration = 0;
        var statement;
        if (issueId !== null) {
            statement = this.db.createStatement("SELECT SUM(`duration`) AS `duration` FROM `time_entries` WHERE `issue_id`=:issue_id;");
            statement.params.issue_id = issueId;
        }
        else {
            statement = this.db.createStatement("SELECT SUM(`duration`) AS `duration` FROM `time_entries`;");
        }
        try {
            statement.executeStep();
            duration = statement.row.duration === null ? 0 : statement.row.duration;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return duration;
    },

    /* ::::: issues ::::: */

    updateIssue: function(id, subject='') {
        this.openDB();
        var statement = this.db.createStatement("INSERT OR REPLACE INTO `issues` (`id`, `subject`) VALUES (:id, :subject);");
        statement.params.id = id;
        statement.params.subject = subject;
        try {
            statement.execute();
        }
        finally {
            statement.reset();
        }
        this.closeDB();
    },

    getIssueSubject: function(id) {
        this.openDB();
        var subject = null;
        var statement = this.db.createStatement("SELECT `subject` FROM `issues` WHERE `id`=:id;");
        statement.params.id = id;
        try {
            statement.executeStep();
            subject = statement.row.subject;
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return subject;
    },

    getIssues: function(limit=10) {
        this.openDB();
        var issues = [];
        //var statement = this.db.createStatement("SELECT `id`, `subject` FROM `issues` WHERE `id`!=0 LIMIT :limit");
        var statement = this.db.createStatement("SELECT `i`.`id`, `i`.`subject` FROM `issues` AS `i` LEFT JOIN `time_entries` AS `t` ON `t`.`issue_id`=`i`.`id` WHERE `i`.`id`!=0 GROUP BY `i`.`id` ORDER BY MAX(`t`.`time_start`) DESC LIMIT :limit");
        statement.params.limit = limit;
        try {
            while (statement.executeStep()) {
                issues.push({id: statement.row.id, subject: statement.row.subject});
            }
        }
        finally {
            statement.reset();
        }
        this.closeDB();
        return issues;
    },
}
