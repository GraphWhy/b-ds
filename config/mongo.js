'use strict';

var MONGO_ADDRESS = process.env.MONGO_ADDRESS || '127.0.0.1'
  , MONGO_PORT    = process.env.MONGO_PORT    || 27017
  , MONGO_DB      = process.env.MONGO_DB      || 'dynamicstory_' +
                        (process.env.NODE_ENV || 'development')
  , MONGO_OPTIONS = {}

if (process.env.NODE_ENV === 'production') {

  MONGO_OPTIONS =
  { user: process.env.MONGO_USER || undefined
  , pass: process.env.MONGO_PASS || undefined
  }

}
var Config =
{ address : MONGO_ADDRESS
, port    : MONGO_PORT
, db      : MONGO_DB
, options : MONGO_OPTIONS
}

module.exports = Config
