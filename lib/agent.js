var log = require('logger')('hub-agent:agent');
var uuid = require('node-uuid');
var utils = require('utils');
var https = require('https');
var socproc = require('socproc-client');
var fs = require('fs');

var token = utils.token();

var HUB = 'hub.serandives.com:4000';

var emit = function (event, agent, args) {
    args = Array.prototype.slice.call(args);
    var dones = agent.ons[event];
    if (dones) {
        dones.forEach(function (done) {
            done.apply(done, args);
        });
    }
    dones = agent.onces[event];
    if (dones) {
        dones.forEach(function (done) {
            done.apply(done, args);
        });
        agent.onces[event] = [];
    }
};

var listen = function (agent, hub) {
    hub.on('emitted', function (name, id, data) {
        if (log.debug) {
            log.debug('emitted %s, %s, %s', name, id, data);
        }
        var done = agent.queue[id];
        done.apply(done, [false].concat(data));
        delete agent.queue[id];

    });
    hub.on('join', function () {
        emit('join', agent, arguments);
    });
    hub.on('leave', function () {
        emit('leave', agent, arguments);
    });
};

/**
 * uses following socproc interface
 * event: emiton => hub.emit('emit', id, name, data);
 * event: joined data: joined drone information
 * @constructor
 */

var Agent = function (hub) {
    this.hub = hub;
    this.queue = {};
    this.ons = {};
    this.onces = {};
    this.pipe = null;
    listen(this, hub);
};

Agent.prototype.emiton = function (event) {
    var id = uuid.v4();
    var args = Array.prototype.slice.call(arguments, 1);
    this.queue[id] = args.pop();
    if (log.debug) {
        log.debug('emitted emiton %s, %s, %s', event, id, JSON.stringify(args));
    }
    this.hub.emit('emit', event, id, args);
};

Agent.prototype.on = function (event, done) {
    var dones = this.ons[event] || (this.ons[event] = []);
    dones.push(done);
};

Agent.prototype.once = function (event, done) {
    var dones = this.onces[event] || (this.onces[event] = []);
    dones.push(done);
};

Agent.prototype.emit = function (event) {
    this.hub.emit(event, Array.prototype.slice.call(arguments, 1));
};

Agent.prototype.pipe = function (to) {
    this.pipe = to;
};

module.exports = function (done) {
    var agent = new https.Agent({
        key: fs.readFileSync('/etc/ssl/serand/hub-client.key'),
        cert: fs.readFileSync('/etc/ssl/serand/hub-client.crt'),
        ca: fs.readFileSync('/etc/ssl/serand/hub.crt')
    });

    if (log.debug) {
        log.debug('connecting to %s', HUB);
    }

    var hub = socproc('drones', agent, {
        server: HUB,
        query: 'token=' + token
    });

    hub.on('connect', function (exec) {
        log.info('drone : %s connected to hub', process.pid);
        done(new Agent(exec.server));
    });

    hub.on('reconnect', function (exec) {
        log.info('drone : %s connected to hub', process.pid);
    });
};