'use strict';

var util = require('util')

var conf =
  { host: process.env.ID_SERVER_HOST || 'localhost'
  , port: 3001
  , method: 'POST'
  , path: '/nextPrettyId'
  }

conf.url = util.format('http://%s:%d%s', conf.host, conf.port, conf.path)

module.exports = conf
