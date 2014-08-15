var proxy = require('proxy');

module.exports = function (server) {
    server.listen(function () {
        var address = server.address();
        console.log('listening on ' + JSON.stringify(address));
        if (!process.send) {
            return;
        }
        process.send({
            event: 'drone started',
            address: address,
            pid: process.pid
        });
    });
};

module.exports.proxy = function (self) {
    var options = {};
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
    var disallow = function (drone) {
        var opts = options[drone.domain];
        if (!opts) {
            return;
        }
        var i, length = opts.length;
        for (i = 0; i < length; i++) {
            var opt = opts[i];
            if (opt.ip === drone.ip && opt.port === drone.port) {
                opt.splice(i, 1);
                break;
            }
        }
    };
    var prxy;
    process.on('message', function (data) {
        switch (data.event) {
            case 'drone joined':
                console.log('drone jointed : ' + JSON.stringify(data.drone));
                allow(data.drone);
                break;
            case 'drone left':
                console.log('drone left : ' + JSON.stringify(data.drone));
                disallow(data.drone);
                break;
            case 'drones list':
                console.log('drones : ' + JSON.stringify(data.drones));
                data.drones.forEach(function (drone) {
                    allow(drone);
                });
                break;
        }
        prxy = proxy(options);
    });
    return function (req, res, next) {
        console.log('proxying requests with : ' + JSON.stringify(options));
        prxy ? prxy(req, res, next) : next();
    };
};