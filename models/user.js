'use strict';

var async     = require('async')
  , bcrypt    = require('bcrypt')
  , crypto    = require('crypto')
  , mongoose  = require('mongoose')
  , validator = require('validator')

var Session = require('./session')
  , Db      = require('./database')

var Config = require('../config/constants')

var DSError = require('../error')

var UserSchema = mongoose.Schema(
  { username      : {type: String,  required: true, unique: true}
  , usernameLower : {type: String,  required: true, unique: true}
  , email         : {type: String,  required: true, unique: true}
  , password      : {type: String,  required: true}
  , creationDate  : {type: Date,    required: true, default: Date.now}
  , isDeleted     : {type: Boolean, default: false}
  , isActivated   : {type: Boolean, default: false}
  , activationId  : {type: String,  unique: true}
  }
)

var UserMongoModel = Db.model('users', UserSchema)


function generateActivationId(callback, attempts) {

  if (!attempts) {
    attempts = 0
  } else if (attempts > Config.Misc.nonceMaxAttempts) {
    var err   = new Error('generateActivationId recurred too many times.')
    var dsErr = new DSError.ServerError(
                  'Something went wrong with the server.', err)
    callback(dsErr)
    return
  }

  crypto.randomBytes(Config.User.activationIdNonceBytes, function(err, nonce) {
    if (err) {
      callback(new DSError.ServerError(
                'Something went wrong with the server.', err))
    } else {

      var activationId = nonce.toString('base64').replace(/[/+=]/g, '')

      // Check to make sure the activation id doesn't already exist in the DB.
      UserMongoModel
        .findOne({ activationId: activationId })
        .select('_id')
        .exec(function(err, user) {
          if (user) {
            // This nonce is already used.
            generateActivationId(callback, attempts + 1)
          } else {
            callback(DSError.wrapMongoError(err), activationId)
          }
        })
    }
  })
}

function createUser(username, userEmail, userPassword, callback) {

  // Use series to check to see if username or email already exists
  async.parallel(
    [ function(next) {
        UserMongoModel
          .findOne({ usernameLower: username.toLowerCase() })
          .select('_id')
          .exec(function(err, user) {
            next(DSError.fromDocumentShouldntExist(
              err, user, 'Username already exists.'
            ))
          })
      }
    , function(next) {
        UserMongoModel
          .findOne({ email: userEmail.toLowerCase() })
          .select('_id')
          .exec(function(err, user) {
            next(DSError.fromDocumentShouldntExist(
              err, user, 'Email already exists.'
            ))
          })
      }
    ]
  , function(err) {
      if (err) {
        callback(err) // Already DSError.
      } else {
        async.parallel({
          passwordHash: function(next) {
            bcrypt.hash(userPassword, Config.User.saltRounds
            , function(err, hash) {
                if (err) {
                  next(new DSError.ServerError(
                    'Something went wrong with the server.', err
                  ))
                } else {
                  next(null, hash)
                }

              }
            )
          }
        , activationId: generateActivationId

        }, function(err, results) {
          if (err) {
            callback(err)
          } else {
            UserMongoModel.create(
              { username      : username
              , usernameLower : username.toLowerCase()
              , email         : userEmail.toLowerCase()
              , password      : results.passwordHash
              , activationId  : results.activationId
              }
            , function(err, user) {

                // Check to see if the user was successfully added to the DB
                if (err) {
                  callback(DSError.wrapMongoError(err))
                } else {
                  Session.create(user._id, function(err, session)  {
                    callback(err, session, user.activationId)
                  })
                }

              }
            )
          }
        })
      }
    }
  )
}

function deleteUser(token, callback) {

  Session.getUser(token, function(err, sessionOwner) {
    if (err) {
      callback(err) // Already DSError.
    } else {

      async.parallel(
        [ function(next) {
            Session.destroyAll(sessionOwner, next)
          }
        , function(next) {
            UserMongoModel
              .findByIdAndUpdate(sessionOwner, { isDeleted: true })
              .select('_id')
              .exec(function(err, user) {

                next(DSError.fromDocumentShouldExist(
                  err, user, 'User not found.'
                ))
              })
          }
        ]
      , callback
      )
    }
  })

}

function getUserById(userId, callback) {
  UserMongoModel
    .findById(userId)
    .exec(DSError.mongoCallback(callback))
}

// Does not include duplicate users even if given duplicate user IDs.
function getUserSetByIds(userIds, callback) {
  UserMongoModel
    .find({ _id: { $in: userIds }})
    .select('username')
    .exec(DSError.mongoCallback(callback))
}

function authenticateUser(usernameEmail, userPassword, callback) {

  async.waterfall(
    [ function(next) {
        // Check to see if usernameEmail is an email or username
        // Check to see if the email or username exists

        var query
        if (validator.isEmail(usernameEmail)) {
          query = { email: usernameEmail.toLowerCase()
                  , isDeleted: false
                  }
        } else {
          query = { usernameLower: usernameEmail.toLowerCase()
                  , isDeleted: false
                  }
        }

        UserMongoModel
          .findOne(query)
          .select('_id username password')
          .exec(function(err, user) {
            next(
              DSError.fromDocumentShouldExist(
                err, user, 'Username or Email not found.'
              )
            , user)
          })

      }
    , function(user, next) {

        // Check password.
        bcrypt.compare(userPassword, user.password, function(err, correct) {
          var dsErr
          if (err) {
            next(new DSError.ServerError(
                   'Something went wrong with the server.'
                 , err
                 )
            )
          } else if (!correct) {
            next(new DSError.ClientError('You entered the wrong password.'))
          } else {
            next(null, user)
          }
        })

      }
    ]
  , function (err, user) {
      if (err) {
        callback(err) // Already DSError.
      } else {
        Session.create(user._id, function(err, session) {
          callback(err, user.username, session) // Already DSError.
        })
      }
    }
  )
}

function reauthenticateUser(token, callback) {

  async.waterfall(
    [ function(next) {
        Session.destroy(token, next)
      }
    , function(sess, next) {
        Session.create(sess.owner, next)
      }
    ]
  , callback
  )

}

function logoutUser(token, callback) {
  Session.destroy(token, callback)
}

function updateUserPassword(token, oldPW, newPW, callback) {
  var _sessionOwner // Mongo ID

  async.waterfall(
    [ function(next) {
        // 1. Get session owner
        Session.getUser(token, next)
      }

    , function(sessionOwner, next) {
        _sessionOwner = sessionOwner // Save to outer scope for later use.

        // 2. Get current user document
        UserMongoModel
          .findById(sessionOwner)
          .exec(function(err, user) {
            next(DSError.wrapMongoError(err), user)
          })
      }

    , function(user, next) {
        // 3. Compare old password against user document
        bcrypt.compare(oldPW, user.password, function(err, correct) {
          if (err) {
            next(new DSError.ServerError(
              'Something went wrong with the server.', err
            ))
          } else if (!correct) {
            next(new DSError.ClientError('You entered the wrong password.'))
          } else {
            next()
          }
        })
      }

    , function(next) {
        // 4. Generate hash from new password
        bcrypt.hash(newPW, Config.User.saltRounds, function(err, hash) {
          if (err) {
            next(new DSError.ServerError(
              'Something went wrong with the server.', err
            ))
          } else if (!hash) {
            next(new DSError.ServerError(
              'Something went wrong with the server.'
            , new Error('Bcrypted hash failed.')
            ))
          } else {
            next(null, hash)
          }
        })
      }

    , function(hash, next) {
        // 5. Update user document
        UserMongoModel
          .findByIdAndUpdate(_sessionOwner, { password: hash })
          .select('_id')
          .exec(function(err, user) {
            if (err) {
              next(DSError.wrapMongoError(err))
            } else if (!user) {
              // Maybe the user was deleted between step 2 and now?
              next(new DSError.ServerError(
                'Internal server error.'
              , new Error('Inconsistency. User wasn\'t found anymore.')
              ))
            } else {
              next()
            }
          })
      }
    ]

  , callback // Already DSError.
  )

}

function activateAccount(activationId, callback) {
  UserMongoModel.findOneAndUpdate({activationId: activationId}
  , {$set: {isActivated: true, activationId: null}})
    .exec(function(err, user) {
      if (err) {
        callback(DSError.wrapMongoError(err))
      } else if (!user) {
        callback(new DSError.ClientError(
          'Activation ID not found.'
        ))
      } else {
        callback()
      }
    }
  )
}

var UserModel =
  { create         : createUser
  , delete         : deleteUser
  , getById        : getUserById
  , getSetByIds    : getUserSetByIds
  , authenticate   : authenticateUser
  , reauthenticate : reauthenticateUser
  , logout         : logoutUser
  , updatePassword : updateUserPassword
  , activate       : activateAccount
  }

module.exports = UserModel
