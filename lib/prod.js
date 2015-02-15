var log = require('logger')('hubber:prod');
var uuid = require('node-uuid');
var child_process = require('child_process');
var spawn = child_process.spawn;

/**
 * sets up the production environment for the given repo
 * @param parent
 * @param repo
 * @param done
 */
module.exports.setup = function (parent, repo, done) {
    var id = uuid.v4();
    var dir = parent + '/' + id;
    if (log.debug) {
        log.debug('setting up repo %s in %s', repo, dir);
    }
    var bash = spawn('bash');
    bash.stdout.pipe(process.stdout);
    bash.stderr.pipe(process.stderr);

    bash.stdin.write('git clone ' + repo + ' ' + dir + '\n');
    bash.stdin.write('cd ' + dir + '\n');
    bash.stdin.write('npm install' + '\n');
    bash.stdin.write('component install' + '\n');
    bash.stdin.write('kill -9 ' + bash.pid + '\n');

    bash.on('close', function (code, signal) {
        if (log.debug) {
            log.debug('setup process exited (%s)', signal || code);
        }
        done(false, id, dir);
    });
};
