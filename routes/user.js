
module.exports = function(router) {

  'use strict';

  var validator = require('validator')

  var ShallowValidator = require('./shallow_validator')

  // Include the user model and session
  var Session = require('../models/session')
    , User    = require('../models/user')

  var EmailConfig = require('../config/email')

  function createActivationEmail(username, userEmail, activationId) {

    // (TEMP) When we add email confirmation/authentication,
    //        We will need to figure how to handle this.
    if (EmailConfig.isSmtpOk) {
      var url = 'https://dynamicstory.org/user/activate/'

      var messageBody =
        'Hey ' + username + ',\n\n' +

        'Welcome to DynamicStory.org! You are awesome!\n\n' +

        'Click on the following URL to activate your account: ' +
        url + activationId + '\n\n' +

        'Alternatively, you can visit ' + url +
        ' and type in the following Activation ID when asked:\n' +
        'Activation ID: ' + activationId + '\n\n' +

        'The DynamicStory Team'

      var emailMessage =
        { from    : EmailConfig.mainAddress
        , to      : userEmail
        , subject : 'Thanks for signing up for an account ' +
                    'on DynamicStory.org!'
        , text    : messageBody
        }

      EmailConfig.Smtp.sendMail(emailMessage, function(err, info) {
        if (err) {
          console.trace(err)
        }
      })

    } else {
      console.error('Could not send Signup email to user ' +
        'because SMTP is not configured.'
      )
    }
  }

  function handleUserCreate(req, res) {

    // Grab User input and sanitize them with validator
    var username      = validator.toString(req.body.username)
      , userEmail     = validator.toString(req.body.email)
      , userPassword  = validator.toString(req.body.password)

    if (ShallowValidator.sendError(res,
      ShallowValidator.username(username))) { return }

    if (ShallowValidator.sendError(res,
      ShallowValidator.email(userEmail))) { return }

    if (ShallowValidator.sendError(res,
      ShallowValidator.password(userPassword))) { return }

    // returns session as 2nd param
    User.create(username, userEmail, userPassword
    , function(err, sess, activationId) {
        if (err) {
          err.printIfInternal()

          res.send(err.result)
        } else {

          createActivationEmail(username, userEmail, activationId)

          var token = Session.convertNonceToToken(sess.nonce)
            , ttl   = (sess.expirationDate - Date.now())

          res.send(
            { code    : 200
            , message : 'User successfully created.'
            , token   : token
            , ttl     : ttl
            }
          )
        }
      }
    )
  }

  function handleUserDelete(req, res) {

    var token = req.headers.token

    if (ShallowValidator.sendError(res,
      ShallowValidator.token(token))) { return }

    User.delete(token, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send(
          { code: 200
          , message: 'Your account has been deleted. Good bye!'
          }
        )
      }
    })
  }

  function handleUserAuthenticate(req, res) {

    // Grab User Input and sanitize them with validator
    var usernameEmail = validator.toString(req.body.usernameemail)
      .toLowerCase()
      , userPassword  = validator.toString(req.body.password)

    if (ShallowValidator.sendError(res,
      ShallowValidator.usernameEmail(usernameEmail))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.password(userPassword))) { return }


    // returns session as 2nd param
    User.authenticate(usernameEmail, userPassword, function(err, username, sess) {
      if (err) {
        err.printIfInternal()

        res.send(err.result)
      } else {
        var token = Session.convertNonceToToken(sess.nonce)
          , ttl   = (sess.expirationDate - Date.now())

        res.send(
          { code     : 200
          , message  : 'You have logged in.'
          , username : username
          , token    : token
          , ttl      : ttl
          }
        )
      }
    })
  }

  function handleUserReauthenticate(req, res) {
    var token = req.headers.token

    if (ShallowValidator.sendError(res,
      ShallowValidator.token(token))) { return }

    // Session gets validated here because this method finds the
    // session in the DB before to destroy it, then regenerate it.
    User.reauthenticate(token, function(err, sess) {
      if (err) {
        err.printIfInternal()

        res.send(err.result)
      } else {
        var _token = Session.convertNonceToToken(sess.nonce)
          , ttl   = (sess.expirationDate - Date.now())

        res.send(
          { code    : 200
          , message : 'Session successfully refreshed.'
          , token   : _token
          , ttl     : ttl
          }
        )
      }
    })
  }

  function handleUserLogout(req, res) {

    var token = req.headers.token

    if (ShallowValidator.sendError(res,
      ShallowValidator.token(token))) { return }

    // Session gets validated here because this method finds the
    // session in the DB before to destroy it.
    User.logout(token, function(err) {
      if (err) {
        err.printIfInternal()

        res.send(err.result)
      } else {

        res.send(
          { code    : 200
          , message : 'You have logged out.'
          }
        )
      }
    })


  }

  function handleUserPasswordUpdate(req, res) {

    var token = req.headers.token
      , oldPW = validator.toString(req.body.oldPassword)
      , newPW = validator.toString(req.body.newPassword)

    //
    // Sanitize user input
    //

    if (ShallowValidator.sendError(res,
      ShallowValidator.token(token))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.password(oldPW))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.password(newPW))) { return }

    //
    // Process request
    //

    User.updatePassword(token, oldPW, newPW, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send(
          { code    : 200
          , message : 'Your password has been changed successfully.'
          }
        )
      }
    })

  }

  function handleUserActivate(req, res) {
    var activationId = req.body.activationid

    if (ShallowValidator.sendError(res,
      ShallowValidator.activationId(activationId))) { return }

    User.activate(activationId, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send(
          { code    : 200
          , message : 'Your account is now activated.'
          }
        )
      }
    })
  }

  // Base URL is /v1/user
  router.post  ('/',               handleUserCreate)
  router.delete('/',               handleUserDelete)
  router.post  ('/authenticate',   handleUserAuthenticate)
  router.post  ('/reauthenticate', handleUserReauthenticate)
  router.post  ('/logout',         handleUserLogout)
  router.put   ('/password',       handleUserPasswordUpdate)
  router.post  ('/activate',       handleUserActivate)
}
