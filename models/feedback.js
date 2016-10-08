'use strict';

var async      = require('async')
  , mongoose   = require('mongoose')
  , nodemailer = require('nodemailer')
  , validator  = require('validator')

var Db      = require('./database')
  , Session = require('./session')
  , User    = require('./user')

var EmailConfig  = require('../config/email')

var DSError = require('../error')

var ObjectId = mongoose.Schema.ObjectId

var FeedbackSchema = mongoose.Schema(
  { message   : {type: String,   required: true}
  , author    : {type: ObjectId, required: true}
  , timestamp : {type: Date,     required: true, default: Date.now}
  }
)

var FeedbackMongoModel = Db.model('feedbacks', FeedbackSchema)

function receiveFeedback(token, feedbackText, callback) {

  if (!EmailConfig.isSmtpOk) {
    callback(
      new DSError.ServerError(
        'Internal server error.'
      , new Error('Feedback received, but SMTP not configured.')
      )
    )
    return
  }

  async.waterfall(
    [ function(next) {
        Session.getUser(token, next)
      }
    , function(sessionOwner, next) {
        User.getById(sessionOwner, function(err, user) {
          next(err, sessionOwner, user)
        })
      }
    , function(sessionOwner, user, next) {

        // Plain-text email message body.
        var messageBody =
          'Username: ' + user.username + '\n' +
          'Email: ' + user.email + '\n' +
          '\n' +
          validator.escape(feedbackText)

        async.parallel(
          [ function(done) {
              // For these fields, please see:
              // https://www.npmjs.com/package/nodemailer#e-mail-message-fields
              var emailMessage =
                { from    : EmailConfig.mainAddress
                , to      : EmailConfig.mainAddress
                , replyTo : user.email
                , subject : 'DynamicStory feedback from ' + user.username
                , text    : messageBody
                }

              EmailConfig.Smtp.sendMail(emailMessage, function(err, info) {
                if (err) {
                  next(new DSError.ServerError('Feedback sending failed.', err))
                } else {
                  next()
                }
              })
            }
          , function(done) {
              FeedbackMongoModel.create(
                { message : messageBody
                , author  : sessionOwner
                }
              , function(err) {
                  done(DSError.wrapMongoError(err))
                }
              )
            }
          ]
        , next
        )
      }
    ]
  , callback // 1st param passed, "err", already DSError
  )

}

var FeedbackModel =
  { giveFeedback  : receiveFeedback
  }

module.exports = FeedbackModel
