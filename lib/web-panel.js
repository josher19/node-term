var term;

term = require('./main');

term.start(process.env['app_port'] || 8080, 'root', 'pass1234');
