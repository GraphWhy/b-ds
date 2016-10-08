'use strict';

var _         = require('lodash')
  , async     = require('async')
  , mongoose  = require('mongoose')
  , validator = require('validator')

var Db      = require('./database')
  , Session = require('./session')
  , Story   = require('./story')
  , Vote    = require('./vote')
  , Config  = require('../config/constants')

var DSError = require('../error')

var ObjectId = mongoose.Schema.ObjectId

var QuestionSchema = mongoose.Schema(
    { title        : {type: String,   required: true}
    , answers      : {type: [String], required: true}
    , author       : {type: ObjectId, required: true}
    , creationDate : {type: Date,     required: true, default: Date.now}
    }
  )

QuestionSchema.path('title').validate(
  function(title) {
    // validator's isLength function counts characters.  Node's length
    // property on strings counts bytes, so we shouldn't use that here.
    return validator.isLength(title, Config.Question.titleMinLen) &&
          !validator.isLength(title, Config.Question.titleMaxLen + 1)
  }
, 'Question does not meet length requirements.'
)

QuestionSchema.path('answers').validate(
  function(answers) {
    return _.all(answers, function(answer) {
      // validator's isLength function counts characters.  Node's length
      // property on strings counts bytes, so we shouldn't use that here.
      return validator.isLength(answer, Config.Question.answerMinLen) &&
            !validator.isLength(answer, Config.Question.answerMaxLen + 1)
    })
  }
, 'Question answers do not meet length requirements.'
)

var QuestionMongoModel = Db.model('questions', QuestionSchema)

/**
 * Create a new question and save it to DB.
 *
 * @param {String} title the display title for the question
 * @param {[String]} answers list of five possible answers users can vote on
 * @param {String} author user ID of the user who created this question
 * @param {Function} callback returns 1) error and 2) question ID string
 * @return nothing
 */
function createQuestion(title, answers, author, callback) {

  QuestionMongoModel.create(
    { title   : title
    , answers : answers
    , author  : author
    }
  , function(err, question) {
      var questionId
      if (question) {
        questionId = question._id
      }
      callback(DSError.wrapMongoError(err), questionId)
    }
  )

}

/**
 * Fetch a question from the DB.
 *
 * @param {String} id the question ID string
 * @param {Function} callback takes two arguments:
 *                     (1) {DSError} error
 *                     (2) {Object} question's title and answers
 * @return nothing
 */

function getQuestion(token, questionId, callback) {
  async.parallel(
    { question: function(next) {
        QuestionMongoModel
          .findById(questionId)
          .select('-_id title answers')
          .exec(function(err, question) {
            next(
              DSError.fromDocumentShouldExist(
                err, question, 'Couldn\'t find that question.'
              )
            , question
            )
          })
      }
    , votes: function(next) {
        Vote.count(questionId, next)
      }
    , userVote: function(next) {
        if (token) {
          Session.getUser(token, function(err, sessionOwner) {
            if (err) {
              // Do not pass error on. If a user's login token has expired or was expunged,
              // we continue with the request but will not return a vote object.
              next(null)
            } else {
              Vote.get(sessionOwner, questionId, next)
            }
          })
        } else {
          next(null)
        }
      }
    }
  , function(err, results) {

      if (err) {
        callback(err) // Already DSError.
      } else {
        // Format our response
        var question = results.question
          , votes    = results.votes
          , answers  = []
        var userVote = results.userVote ? results.userVote.answer : null
        for (var i in votes) {
          answers.push(
            { name  : question.answers[i]
            , votes : votes[i]
            }
          )
        }
        callback(
          null
        , { title    : question.title
          , answers  : answers
          , userVote : userVote
          }
        )
      }
    }
  )
}

/**
 * Register a user's vote on a specified question.
 *
 * @param {String} questionId question to be voted on
 * @param {Number} answer vote choice from 0-4
 * @param {String} storyPrettyId story from where question is being voted on
 * @param {Function} callback takes (1) DSError
 * @return nothing
 */
function voteOnQuestion(token, questionId, answer, storyPrettyId, callback) {

  async.parallel({
    userId: function(next) {
      // Verify the user is logged in.
      Session.getUser(token, next)
    }
  , questionId: function(next) {
      // Verify question exists.
      QuestionMongoModel
        .findById(questionId)
        .exec(function(err, question) {
          next(DSError.fromDocumentShouldExist(
            err, question, 'That question doesn\'t exist.'
          ))
        })
    }
  , storyPrettyId: function(next) {
      // Verify story exists.
      Story.exists(storyPrettyId, next)
    }
  }, function(err, results) {
    if (err) {
      callback(err) // already DSError
    } else {
      // If the user, question, and story are valid, cast the vote!

      // The only return value from the above parallel that we use is userId.
      // We already have questionId and storyPrettyId from this function's
      // parameters.
      Vote.cast(results.userId, questionId, answer, storyPrettyId, callback)
    }
  })
}

var QuestionModel =
  { create : createQuestion
  , get    : getQuestion
  , vote   : voteOnQuestion
  }

module.exports = QuestionModel
