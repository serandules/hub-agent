var log = require('logger')('hub-agent');
var fs = require('fs');
var https = require('https');
var io = require('socket.io-client');

var configs = require('hub-configs');

module.exports = function (ns, done) {
    var agent = new https.Agent({
        key: fs.readFileSync(configs.ssl.key),
        cert: fs.readFileSync(configs.ssl.cert),
        ca: [fs.readFileSync(configs.ssl.ca)]
    });

    var socket = io('wss://' + configs.domain + ':' + configs.port + ns, {
        transports: ['websocket'],
        agent: agent,
        query: 'token=' + configs.token
    });

    socket.on('connect', function () {
        log.info('connected hub %s', ns);
    });

    done(false, socket);
};