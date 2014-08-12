var proxy = require('proxy');

module.exports = function (server) {
    server.listen(function () {
        var address = server.address();
        console.log('listening on ' + JSON.stringify(address));
        if (!process.send) {
            return;
        }
        process.send({
            event: 'started',
            address: address,
            pid: process.pid
        });
    });
};

module.exports.proxy = function (self) {
    var options = {
        'accounts.serandives.com': 4004,
        'auto.serandives.com': 4004,
        'localhost': 4004
    };
    var allow = function (drone) {
        var domain = drone.domain;
        if (domain.indexOf('*.') === -1) {
            domain = domain.substring(2);
            if (domain === self) {
                return;
            }
        } else if (domain !== self) {
            return;
        }
        var opts = options[domain] || (options[domain] = []);
        opts.drones.push({
            ip: drone.ip,
            port: drone.port
        });
    };
    var prxy;
    process.on('message', function (data) {
        switch (data.event) {
            case 'drone joined':
                prxy = proxy(allow);
                break;
            case 'drone left':
                break;
        }
    });
    return function (req, res, next) {
        prxy ? prxy(req, res, next) : next();
    };
};