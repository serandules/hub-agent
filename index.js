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
    var allow = function (domains) {
        var name, opts,
            options = {};
        for (name in domains) {
            if (domains.hasOwnProperty(name)) {
                if (name.indexOf('*.') === -1) {
                    console.log('load balancing drone : ' + name);
                    name = name.substring(2);
                    if (self === name) {
                        console.log('self domain, skipping proxying');
                        return;
                    }
                } else if (self !== name) {
                    return;
                }
                options[name] = domains[name];
            }
        }
        console.log('proxying allowed : ' + JSON.stringify(options));
        return options;
    };
    /*var disallow = function (drone) {
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
     };*/
    var prxy;
    process.on('message', function (data) {
        switch (data.event) {
            case 'drone joined':
                console.log('drone jointed : ' + JSON.stringify(data.drone));
                //allow(data.drone);
                break;
            case 'drone left':
                console.log('drone left : ' + JSON.stringify(data.drone));
                //disallow(data.drone);
                break;
            case 'drones update':
                console.log('drones : ' + JSON.stringify(data.domains));
                prxy = proxy(allow(data.domains));
                break;
        }
    });
    return function (req, res, next) {
        console.log('proxying requests with : ' + JSON.stringify(options));
        prxy ? prxy(req, res, next) : next();
    };
};