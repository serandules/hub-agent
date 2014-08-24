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

module.exports.proxy = function () {
    var self;
    var allow = function (domains) {
        var id, name, o,
            options = {};
        for (id in domains) {
            if (domains.hasOwnProperty(id)) {
                o = domains[id];
                name = o.domain.name;
                console.log('name : ' + name);
                if (name.indexOf('*.') === 0) {
                    console.log('load balancing drone : ' + name);
                    name = name.substring(2);
                    console.log('domain : ' + name + ' self : ' + self);
                    if (self === name) {
                        console.log('self domain, skipping proxying');
                        continue;
                    }
                } else if (self !== name) {
                    console.log('non-self non load balancing drone, skipping proxying');
                    continue;
                }
                options[name] = o.drones;
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
            case 'self domain':
                self = data.domain;
                self = self.indexOf('*.') === 0 ? self.substring(2) : self;
                break;
            case 'drones update':
                console.log('drones : ' + JSON.stringify(data.domains));
                prxy = proxy(allow(data.domains));
                break;
        }
    });
    return function (req, res, next) {
        prxy ? prxy(req, res, next) : next();
    };
};