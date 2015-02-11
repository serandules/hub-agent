var log = require('logger')('hub-agent:agent');
var uuid = require('node-uuid');
var utils = require('utils');
var https = require('https');
var socproc = require('socproc-client');
var fs = require('fs');

var token = utils.token();

var HUB = 'hub.serandives.com:4000';

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
        var server = exec.server;
        var agent = new Agent(server);
        server.on('emitted', function (name, id, data) {
            if (log.debug) {
                log.debug('emitted %s, %s, %s', name, id, data);
            }
            var done = agent.queue[id];
            done.apply(done, [false].concat(data));
            delete agent.queue[id];

        });
        /*server.on = function (event) {
         var args = Array.prototype.slice.call(arguments, 1);
         var dones = that.ons[event];
         if (dones) {
         dones.forEach(function (done) {
         done.apply(args);
         });
         }
         dones = that.onces[event];
         if (dones) {
         dones.forEach(function (done) {
         done.apply(args);
         });
         that.onces[event] = [];
         }
         };*/
        done(agent);
    });

    hub.on('reconnect', function (exec) {
        log.info('drone : %s connected to hub', process.pid);
    });
};