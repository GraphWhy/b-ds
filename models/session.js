'use strict';

var async     = require('async')
  , crypto    = require('crypto')
  , mongoose  = require('mongoose')
  , validator = require('validator')

// Include database
var Db = require('./database')

var Config = require('../config/constants')

var DSError = require('../error')

// Get the ObjectId datatype from mongo
var ObjectId  = mongoose.Schema.ObjectId


function createExpirationDate() {
  return (Date.now() + Config.Session.ttl)
}

// Create Session Schema
var SessionSchema = mongoose.Schema(
  { owner         : {type: ObjectId, required: true}
  , nonce         : {type: Buffer, required: true, unique: true}
  , expirationDate: {type: Date, default: createExpirationDate, expires: 0 }
  }
)

var SessionMongoModel = Db.model('Session', SessionSchema)

function generateNonce(callback, attempts) {

  if (!attempts) {
    attempts = 0
  } else if (attempts > Config.Misc.nonceMaxAttempts) {
    var err   = new Error('generateNonce recurred too many times.')
    var dsErr = new DSError.ServerError(
                  'Something went wrong with the server.', err)
    callback(dsErr)
    return
  }

  crypto.randomBytes(Config.Session.randNonceBytes, function(err, nonce) {
    if (err) {
      callback(DSError.wrapMongoError(err))
    } else {

      // Check to make sure the nonce doesn't already exist in the DB.
      SessionMongoModel
        .findOne({ nonce: nonce })
        .select('_id')
        .exec(function(err, session) {
          if (session) {
            // This nonce is already used.
            generateNonce(callback, attempts + 1)
          } else {
            callback(DSError.wrapMongoError(err), nonce)
          }
        })
    }
  })
}

function convertNonceToToken(nonce) {
  if (!Buffer.isBuffer(nonce)) {
    return
  }
  var token = nonce.toString('base64')
  return token
}

function convertTokenToNonce(token) {
  if (!validator.isBase64(token)) {
    return
  }
  var nonce = new Buffer(token, 'base64')
  return nonce
}

function createSession(userId, callback) {
  generateNonce(function(err, nonce) {

    if (err) {
      callback(err) // Already DSError.
    } else {
      SessionMongoModel.create(
        { owner: userId
        , nonce: nonce
        }
      , function(err, session) {
          callback(DSError.wrapMongoError(err), session)
        }
      )
    }

  })
}

// Callback has the destroyed session as the 2nd param
function destroySession(token, callback) {
  var nonce = convertTokenToNonce(token)
  SessionMongoModel
    .findOneAndRemove({ nonce: nonce })
    .exec(function(err, session) {
      callback(
        DSError.fromDocumentShouldExist(err, session, 'Couldn\'t find session.')
      , session
      )
    })
}

function destroyAllSessions(userId, callback) {

  // Find all sessions with that owner and remove them
  SessionMongoModel
    .remove({ owner: userId })
    .exec(function(err, sessions) {
      callback(DSError.wrapMongoError(err))
    })

}

function getSessionUser(token, callback) {
  var nonce = convertTokenToNonce(token)
  SessionMongoModel
    .findOne(
      { nonce          : nonce
      , expirationDate : { $gt: new Date() }
      }
    )
    .select('-_id owner')
    .exec(function(err, session) {
      var sessionOwner
      if (session) {
        sessionOwner = session.owner
      }
      callback(
        DSError.fromDocumentShouldExist(err, session, 'Couldn\'t find session.')
      , sessionOwner
      )
    })
}

// README: This function is not being used
function validateSession(token, callback) {
  var nonce = convertTokenToNonce(token)
  SessionMongoModel
    .findOne({ nonce: nonce, expirationDate: { $gt: new Date() } })
    .exec(function(err, session) {
      callback(DSError.fromDocumentShouldExist(
        err
      , session
      , 'Couldn\'t find session.'
      ))
    })
}

var SessionObject =
  { create              : createSession
  , destroy             : destroySession
  , destroyAll          : destroyAllSessions
  , getUser             : getSessionUser
  , convertTokenToNonce : convertTokenToNonce
  , convertNonceToToken : convertNonceToToken
  , validate            : validateSession
  }

module.exports = SessionObject
