term = require 'node-term'
term.start process.env['app_port'] || 8080, 'root', 'pass1234'
