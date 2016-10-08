// Run both server-id.js and server.js at once.  Wait until one of them quits,
// then quit ourselves, killing the other by parent death.  Ctrl-C will kill
// both.
'use strict'

var spawn = require('child_process').spawn

function die(err) {
  console.error(err.stack)
  process.exit()
}

var scripts = ['server.js', 'server-id.js']

scripts.map(function(script) {
  spawn('node', [script], {stdio: 'inherit'})
    .on('error', die)
    .on('exit',  process.exit)
})
