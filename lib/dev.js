var log = require('logger')('hubber:dev');
var child_process = require('child_process');
var uuid = require('node-uuid');
var spawn = child_process.spawn;

var name = function (repo) {
    return repo.substring(repo.lastIndexOf('/') + 1, repo.lastIndexOf('.'));
};

var locals = process.env.LOCALS || '/Users/ruchira/sources/github';

var linkMods = function () {
    var cmd = 'mkdir node_modules;';
    cmd += 'for dir in ' + locals + '/serandules/*; do rm -rf `pwd`/node_modules/$(basename "$dir");';
    cmd += 'ln -s ' + locals + '/serandules/$(basename "$dir") `pwd`/node_modules/$(basename "$dir"); done;\n';
    return cmd;
};

var linkComps = function () {
    var cmd = 'mkdir components;';
    cmd += 'for dir in ' + locals + '/serandomps/*; do rm -rf `pwd`/components/serandomps-$(basename "$dir");';
    cmd += 'ln -s ' + locals + '/serandomps/$(basename "$dir") `pwd`/components/serandomps-$(basename "$dir"); done;';
    cmd += 'ln -s ' + locals + '/visionmedia-page.js `pwd`/components/visionmedia-page.js;';
    cmd += 'ln -s ' + locals + '/pillarjs-path-to-regexp `pwd`/components/pillarjs-path-to-regexp;';
    cmd += 'ln -s ' + locals + '/node-querystring `pwd`/components/visionmedia-node-querystring\n';
    return cmd;
};

/**
 * sets up the development environment for the given repo
 * @param parent
 * @param repo
 * @param done
 */
module.exports.setup = function (parent, repo, done) {
    var id = uuid.v4();
    var n = name(repo);
    var dir = parent + '/' + id;
    if (log.debug) {
        log.debug('using local repo %s', locals);
        log.debug('setting up repo %s in %s', n, dir);
    }
    var bash = spawn('bash');
    bash.stdout.pipe(process.stdout);
    bash.stderr.pipe(process.stderr);
    bash.stdin.write('mkdir -p ' + dir + '\n');
    bash.stdin.write('cp -rf ' + locals + '/serandules/' + n + '/* ' + dir + '\n');
    bash.stdin.write('cd ' + dir + '\n');
    //bash.stdin.write('find . -type l | xargs rm\n');
    bash.stdin.write(linkMods() + '\n');
    bash.stdin.write(linkComps() + '\n');
    bash.stdin.write('kill -9 ' + bash.pid + '\n');

    bash.on('close', function (code, signal) {
        if (log.debug) {
            log.debug('setup process exited (%s)', signal || code);
        }
        done(false, id, dir);
    });
};