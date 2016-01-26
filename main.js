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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var lastData = "";
var timer = null;

const stateNames = {
    everyMessage: "every-message",
    messageChanges: "message-changes",
    messageType: "message-type"
}

function main() {
    
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
        
        
        adapter.setState(stateNames.everyMessage, sData, true);
        if (sData !== lastData) {
            adapter.setState(stateNames.messageChanges, sData, true);
            adapter.setState(stateNames.messageType, "down", true);
            console.log(sData);
            lastData = sData;
        } else {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                adapter.setState(stateNames.messageType, "up", true);
                adapter.setState(stateNames.messageChanges, lastData + ".up", true);
                console.log(lastData + ".up");
                lastData = "";
            }, 200);
        }
    });
    device.on("error", function (err) {
        console.log("err: " + err);
    });
    
    //adapter.subscribeStates('*');
}

