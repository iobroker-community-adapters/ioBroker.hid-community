"use strict";

var utils = require(__dirname + '/lib/utils');
var HID = require('node-hid');

var device = null;

var adapter = utils.adapter({
    name: 'hid',
    
    unload: function (callback) {
        try {
            if (device) device.close();
            callback();
        } catch (e) {
            callback();
        }
    },
    discover: function (callback) {
        //adapter.log.info("adapter hid discovered");
    },
    install: function (callback) {
        //adapter.log.info("adapter hid installed");
    },
    uninstall: function (callback) {
        //adapter.log.info("adapter hid uninstalled");
    },
    //objectChange: function (id, obj) {
    //    //adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
    //},
    //stateChange: function (id, state) {
    //    //adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
    //},
    ready: function () {
        main();
    }
});

const stateDeviceNames = {
    deviceAll: "All",
    deviceKnown: "Known"
}

const stateNames = {
    everyMessage: "every-message",
    messageChanges: "message-changes",
    messageType: "message-type"
}

var unknownKeys = {},
    mappings = {},
    configMappings = {};

var lastData = "",
    timer = null;

function createObjects() {
    for (var i in stateDeviceNames) {
        adapter.setObjectNotExists(stateDeviceNames[i], { type: 'device', common: { name: stateDeviceNames[i], role: 'device' }, native: {} }, function (err, obj) {
        });
    }
    for (var i in stateNames) {
        adapter.setObjectNotExists(stateNames[i], {
            type: 'state',
            common: {
                name: stateNames[i],
                role: 'state',
                type: 'string',
                write: false,
            },
            native: {}
        });
    }
}


function loadMappings() {
    var fs = require('fs'),
        io = fs.readFileSync(__dirname + "/io-package.json"),
        objs = JSON.parse(io);
    
    for (var i in objs.mappings) {
        configMappings [i] = objs.mappings[i].replace(/\s/g, '_');
        //adapter.setObjectNotExists(stateDeviceNames.deviceKnown + '.' + objs.mappings[i], {}, function (err, obj) {
        //    adapter.setState(obj.id, 0, true);
        //});
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//git clone git://github.com/soef/node-hid.git
//npm install --build-from-source

function checkMappings(sData, val) {
    if (!configMappings.hasOwnProperty(sData))
        return;
    var name = stateDeviceNames.deviceKnown + '.' + configMappings[sData];
    if (mappings.hasOwnProperty(sData)) {
        adapter.setState(name, val, true);
        return;
    }
    mappings[sData] = val;
    adapter.setObjectNotExists(name, { type: 'state', common: { name: sData, role: 'state', type: 'boolean' }, native: {} }, function (err, obj) {
        adapter.setState(obj.id, val, true);
    });
}


function updateUnknownKey(sData, val) {
    if (!sData || !adapter.config.createUnknownStates) return;
    var name = stateDeviceNames.deviceAll + '.' + sData;
    if (!unknownKeys.hasOwnProperty(sData)) {
        unknownKeys[sData] = val;
        adapter.setObjectNotExists(name, { type: 'state', common: { name: sData, role: 'state', type: 'boolean' }, native: {} }, function (err, obj) {
            adapter.setState(name, val, true);
        });
        return;
    }
    if (unknownKeys[sData] !== val) {
        unknownKeys[sData] = val;
        adapter.setState(name, val, true);
    }
}


function handlesData(sData) {
    adapter.setState(stateNames.everyMessage, sData, true);
    if (sData !== lastData) {
        checkMappings(sData, true);
        updateUnknownKey(lastData, false);
        updateUnknownKey(sData, true);
        adapter.setState(stateNames.messageChanges, sData, true);
        adapter.setState(stateNames.messageType, "down", true);
        console.log(sData);
        lastData = sData;
    }
    if (false | adapter.config.keyUpTimeout) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
            timer = null;
            checkMappings(sData, false);
            updateUnknownKey(lastData, false);
            adapter.setState(stateNames.messageType, "up", true);
            adapter.setState(stateNames.messageChanges, lastData + ".up", true);
            console.log(lastData + ".up");
            lastData = "";
        }, adapter.config.keyUpTimeout);
    }
}


function main() {
    
    createObjects();
    loadMappings();
    
    //handlesData("000000000002");
    //setTimeout(function () {
    //    handlesData("000000000001");
    //}, 2000);
    //return;    
    
    var devices = HID.devices();
    if (devices) for (var i = 0; i < devices.length; i++) {
        adapter.log.info(JSON.stringify(devices[i]));
    }
    
    if (!adapter.config.vendorID || !adapter.config.productID) {
        adapter.log.error("VendorID and ProductID has to be configured");
        return;
    }
    
    //var device = new HID.HID(devices[5].path);
    var device = new HID.HID(adapter.config.vendorID, adapter.config.productID);
    if (!device) adapter.log.error("can not open device with VendorID " + adapter.config.vendorID + " and Product ID " + adapter.config.productID);
    
    device.on("data", function (data) {
        var sData = data.toString('HEX').toUpperCase();
        adapter.log.debug("HID event deteced: " + sData);
        handlesData(sData);
    });
    
    device.on("error", function (err) {
        console.log("err: " + err);
    });
    
    //adapter.subscribeStates('*');
}

