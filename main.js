"use strict";

var soef = require('./lib/soef'),
    HID = require('node-hid');

var hidDevice = null;
var mappings = {};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var adapter = soef.Adapter (
    main,
    function onUnload (callback) {
        if (hidDevice) {
            hidDevice.close();
            hidDevice = null;
        }
        callback();
    },
    onMessage,
    onUpdate,
    {
        name: 'hid',
        //install: function (callback) {
        //    adapter.log.info('install');
        //    adapter.getForeignObject('system.adapter.' + adapter.namespace, function(err, obj) {
        //        if (!err && obj && obj.common) {
        //            adapter.log.info('installedVersion: ' + obj.common.installedVersion);
        //        }
        //    });
        //    callback();
        //},
        //uninstall: function (callback) {
        //    adapter.log.info('uninstall');
        //    callback();
        //}
    }
);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function onMessage (obj) {
    if (!obj) return;
    switch (obj.command) {
        case 'discovery':
            var devices = [];
            HID.devices().forEach(function(device) {
                adapter.log.debug('device found: ' + JSON.stringify(device));
                if (!devices.some(function (d) {
                        return (d.vendorId == device.vendorId && d.productId == device.productId)
                })) devices.push({
                    name: device.product,
                    manufacturer: device.manufacturer,
                    productId: device.productId,
                    vendorId: device.vendorId
                })
            });

            adapter.log.debug('discovery result: ' + JSON.stringify(devices));
            if (obj.callback) {
                adapter.sendTo (obj.from, obj.command, JSON.stringify(devices), obj.callback);
            }
            return true;
        default:
            adapter.log.warn("Unknown command: " + obj.command);
            break;
    }
    if (obj.callback) adapter.sendTo (obj.from, obj.command, obj.message, obj.callback);
    return true;
}

function onUpdate(prevVersion ,aktVersion, callback) {
    if (prevVersion < 1000) {
        removeAllObjects(adapter, callback);
        return;
    }
    callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var dev;
var last = {
    data: '',
    cnt: 0,
    keyup: ''
};

var sub = {
    wo:     '',
    double: '-double',
    single: '-single-short',
    long:   '-long',
    action: '-action',
    dsl:    '-dsl',
    repcnt: '-repcnt',

    raw: 'raw',
    key: 'key'

};

var stateNames = {
    raw:         { n: sub.raw,              val: '',     common: { write: false, name: 'Raw Key Code', desc: 'key-code, changes on first press'}},
    raw_double:  { n: sub.raw+sub.double,   val: '',     common: { write: false, name: 'Double Klick', desc: 'will only change, if double klicked, otherwise raw' + sub.single + ' or raw' + sub.long + ' will be fired' }},
    raw_single:  { n: sub.raw+sub.single,   val: '',     common: { write: false, name: 'Single Klick', desc: 'will only change, if single/short klicked, otherwise raw' + sub.double + ' or raw' + sub.long + ' will be fired' }},
    raw_long:    { n: sub.raw+sub.long,     val: '',     common: { write: false, name: 'Long Press', desc: 'will only change, if long pressed, otherwise raw' + sub.double + ' or raw' + sub.single + ' will be fired' }},
    raw_action:  { n: sub.raw+sub.action,   val: '',     common: { write: false, name: 'Action', desc: 'key-code + .down, .up or .repeat'}},
    raw_dsl:     { n: sub.raw+sub.dsl,      val: '',     common: { write: false, name: 'Double/Single/Long', desc: 'Same than raw' + sub.double + ', raw'+sub.single + ', raw' + sub.long + ' in one (this) state. key-code + .single, .double or .long'}},
    raw_repcnt:  { n: sub.raw+sub.repcnt,   val: '',     common: { write: false, name: 'Repeat Count', desc: 'key-code + .repeat count'}},

    key:         { n: sub.key,              val: '',     common: { write: false, name: 'Mapped Name', desc: 'name of mapped key-code, changes on first press' }},
    key_double:  { n: sub.key+sub.double,   val: '',     common: { write: false, name: 'Named Double Klick', desc: 'will only change, if double klicked, otherwise key' + sub.single + ' or key' + sub.long + ' will be fired' }},
    key_single:  { n: sub.key+sub.single,   val: '',     common: { write: false, name: 'Named Single Klick', desc: 'will only change, if single/short klicked, otherwise key' + sub.double + ' or key' + sub.long + ' will be fired' }},
    key_long:    { n: sub.key+sub.long,     val: '',     common: { write: false, name: 'Named Long Press', desc: 'will only change, if long pressed, otherwise key' + sub.double + ' or key' + sub.single + ' will be fired' }},
    key_action:  { n: sub.key+sub.action,   val: '',     common: { write: false, name: 'Named Action', desc: 'Name + .down, .up or .repeat'}},
    key_dsl:     { n: sub.key+sub.dsl,      val: '',     common: { write: false, name: 'Named Double/Single/Long', desc: 'Same than key' + sub.double + ', key'+sub.single + ', key' + sub.long + ' in one (this) state. name + .single, .double or .long'}},
    key_repcnt:  { n: sub.key+sub.repcnt,   val: '',     common: { write: false, name: 'Named Repeat Count', desc: 'name + .repeat count'}}
};

function createAll(callback) {

    var hidDeviceName = '';
    var d = HID.devices().find(function(d) {
        return (d.vendorId == adapter.config.vendorID && d.productId == adapter.config.productID);
    });
    if (d) {
        hidDeviceName = d.manufacturer + ' - ' + d.product;
    }
    dev = new devices.CDevice(adapter.config.vendorID + '-' + adapter.config.productID, hidDeviceName);

    //for (var prefix in { raw: '', key: '' }) {
        for (var i in stateNames) {
            var st = Object.assign({}, stateNames[i]);
            var n = st.n;
            delete st.n;
            dev.createNew(n, st);
        }
    //}
    dev.update(callback);
}


function set(name, val, ext) {
    ext = ext || '';
    adapter.log.debug('#'+sub.raw + name + '=' + val + ext);
    dev.set(sub.raw + name, val + ext);
    if (mappings[val]) {
        dev.set(sub.key + name, mappings[val] + ext);
        adapter.log.debug('#' + sub.key + name + '=' + mappings[val] + ext);
    }
}

function setDSL(name, val) {
    set(name, val);
    set(sub.dsl, val + '.' + name.substr(1));
}

//var Timer = {
//    timer: null,
//    set: function (func, timeout, v1) {
//        if (this.timer) clearTimeout(this.timer);
//        this.timer = setTimeout(function() {
//            this.timer = null;
//            func(v1);
//        }.bind(this), timeout);
//    },
//    clear: function() {
//        if (this.timer) clearTimeout(this.timer);
//        this.timer = null;
//    }
//};
//var upTimer = Object.assign({}, Timer);
//var downTimer = Object.assign({}, Timer);

var Timer = function Timer () {
    if (!(this instanceof Timer)) {
        return new Timer();
    }
    var timer = null;
    this.set = function (func, timeout, v1) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() {
            timer = null;
            func(v1);
        }, timeout);
    };
    this.clear = function() {
        if (timer) clearTimeout(timer);
        timer = null;
    }
};
var upTimer = Timer();
var downTimer = Timer();

function upEvent(dev, data, from) {
    if (data == '') return;
    downTimer.clear();
    set(sub.action, data, '.up');
    //adapter.log.debug('keyup: ' + from + ' data=' + data + ' last.keyupp=' + last.keyup + ' cnt=' + last.cnt + ' lastData=' + last.data);
    if (last.cnt<= 2) upTimer.set(function(_lastKeyUp) {
        if (last.cnt <= 2) setDSL(sub.single, _lastKeyUp);
        last.keyup = '';
    }, adapter.config.keyUpTimeout*2, data);
    if (last.cnt <= 2 && last.keyup == data) {
        upTimer.clear();
        setDSL(sub.double, last.keyup);
        last.keyup = '';
    } else {
        last.keyup = data;
    }
    last.data = '';
    last.cnt = 0;
}

function onData(data) {
    var ext;
    if (adapter.config.keyUpTimeout) {
        downTimer.set(function (_data) {
            upEvent(dev, _data, 'timeout');
        }, adapter.config.keyUpTimeout, data);
    }

    if (last.data == data) {
        last.cnt += 1;
        if (last.cnt == 3) {
            upTimer.clear();
            setDSL(sub.long, data);
        }
        ext = '.repeat';
    } else {
        upEvent(dev, last.data, 'other key');
        set(sub.wo, data);
        ext = '.down';
        last.data = data;
    }
    set(sub.action, data, ext);
    if (last.cnt > 1) {
        set(sub.repcnt, data, '.' + last.cnt);
    }
    dev.update();
}

function normalizeConfig(config) {
    config.keyUpTimeout = parseInt(config.keyUpTimeout) | 0;
}

function main() {

    normalizeConfig(adapter.config);
    mappings = adapter.ioPack.mappings;
    if (!adapter.config.vendorID || !adapter.config.productID) {
        adapter.log.error("VendorID and ProductID has to be configured");
        return;
    }

    try {
        hidDevice = new HID.HID(adapter.config.vendorID, adapter.config.productID);
    } catch(e) {
        adapter.log.error(e.message);
        adapter.log.error('If running on Windows, see requirements in readme.md. https://github.com/soef/iobroker.hid/blob/master/README.md');
        return;
    }
    if (!hidDevice) {
        adapter.log.error("can not open device with VendorID " + adapter.config.vendorID + " and Product ID " + adapter.config.productID);
        adapter.log.error('If running on Windows, see requirements in readme.md. https://github.com/soef/iobroker.hid/blob/master/README.md');
        return;
    }
    createAll();

    hidDevice.on("data", function (data) {
        var sData = data.toString('hex').toUpperCase();
        onData(sData);
    });
    hidDevice.on("error", function (err) {
        console.log("err: " + err);
    });
    //adapter.subscribeStates('*');
}

//--msvs_version=2015
