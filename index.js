var log = require('logger')('hub-agent');
var cluster = require('cluster');
var procevent = require('procevent');
var events = require('events');
var util = require('util');
var uuid = require('node-uuid');
var https = require('https');
var fs = require('fs');
var socproc = require('socproc-client');
var agent = require('./lib/agent');

var master = procevent(process);

var cpus = require('os').cpus().length;

module.exports = function (domain, run, forks) {
    if (cluster.isWorker) {
        return run();
    }
    forks = forks || cpus;
    var i;
    var worker;
    var drones = {};
    if (log.debug) {
        log.debug('forking workers');
    }
    for (i = 0; i < forks; i++) {
        worker = cluster.fork();
        drones[worker.process.pid] = {
            worker: worker,
            procevent: procevent(worker.process)
        };
    }
    cluster.on('exit', function (worker, code, signal) {
        if (log.debug) {
            log.debug('%s worker %s stopped (%s)', domain, worker.process.pid, signal || code);
            log.debug('%s worker restarting', domain);
        }
        delete drones[worker.process.pid];
        worker = cluster.fork();
        drones[worker.process.pid] = {
            worker: worker,
            procevent: procevent(worker.process)
        };
    });
    cluster.on('listening', function (worker, address) {
        if (log.debug) {
            log.debug('worker started');
        }
        if (--forks > 0) {
            return;
        }
        if (log.debug) {
            log.debug('all workers started');
        }
        master.emit('started', process.pid, address);
        agent(function (agent) {
            var id;
            var drone;
            agent.domain = domain;
            for (id in drones) {
                if (drones.hasOwnProperty(id)) {
                    drone = drones[id];
                    drone.procevent.emit('ready');
                    drone.procevent.on('emit', function (event, id, p1, p2) {
                        if (log.debug) {
                            log.debug('emit %s %s %s %s', event, id, p1, p2);
                        }
                        //hub.emit.apply(hub, ['emit'].concat(Array.prototype.slice.call(arguments)));
                        agent.emiton(event, p1, p2, function (err, q1, q2) {
                            log.debug('emiton callback %s %s %s', err, q1, q2);
                        });
                    })
                }
            }
        });
    });
    /*process.on('uncaughtException', function (err) {
     log.error('unhandled exception %s', err);
     if (log.debug) {
     log.trace(err.stack);
     }
     });*/
};