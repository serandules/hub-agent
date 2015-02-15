var log = require('logger')('hub-agent:channel');
var uuid = require('node-uuid');
var utils = require('utils');
var https = require('https');
var socproc = require('socproc-client');
var fs = require('fs');

var token = utils.token();

var HUB = 'hub.serandives.com:4000';

module.exports = function (channel, done) {
    var agent = new https.Agent({
        key: fs.readFileSync('/etc/ssl/serand/hub-client.key'),
        cert: fs.readFileSync('/etc/ssl/serand/hub-client.crt'),
        ca: fs.readFileSync('/etc/ssl/serand/hub.crt')
    });

    if (log.debug) {
        log.debug('connecting to %s', HUB);
    }

    var hub = socproc(channel, agent, {
        server: HUB,
        query: 'token=' + token
    });

    hub.on('connect', function (exec) {
        log.info('process : %s connected to hub', process.pid);
        var server = exec.server;
        server.queue = {};
        server.emiton = function (event) {
            var id = uuid.v4();
            var args = Array.prototype.slice.call(arguments, 1);
            server.queue[id] = args.pop();
            if (log.debug) {
                log.debug('emitted emiton %s, %s, %s', event, id, JSON.stringify(args));
            }
            server.emit('emit', event, id, args);
        };
        server.on('emitted', function (id, args) {
            if (log.debug) {
                log.debug('emitted %s, %s', id, args);
            }
            var done = server.queue[id];
            done.apply(done, args);
            delete server.queue[id];

        });
        done(false, server);
    });

    hub.on('reconnect', function (exec) {
        log.info('process : %s connected to hub', process.pid);
    });
};