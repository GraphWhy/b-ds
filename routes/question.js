
module.exports = function(router) {

  'use strict';

  var async     = require('async')
    , validator = require('validator')

  var ShallowValidator = require('./shallow_validator')

  var Question = require('../models/question')
    , Session  = require('../models/session')

  function handleQuestionCreate(req, res) {

    //
    // Sanitize user input
    //

    var token   = req.headers.token
      , answers = req.body.answers
      , title   = req.body.title

    if (ShallowValidator.sendError(res,
      ShallowValidator.token  (token  ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.answers(answers))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.questionTitle  (title  ))) { return }

    //
    // Process request
    //

    async.waterfall([
      function(next) {

        // The session gets validated here since this method checks the
        // DB to see if the session exists to find the owner.
        // Get session owner by token from DB.
        Session.getUser(token, function(err, sessionOwner) {
          next(err, sessionOwner)
        })
      }
    , function(sessionOwner, next) {
        // Create question & save to DB.
        Question.create(title, answers, sessionOwner
        , function(err, questionID) {
            next(err, questionID)
          }
        )
      }
    ], function(err, questionID) {
        // Return any errors from above.
        if (err) {
          err.printIfInternal()
          res.send(err.result)
        } else {
          res.send(
            { code: 200
            , message: 'Question created.'
            , question: questionID
            }
          )
        }
      }
    )

  }

  function handleQuestionFetch(req, res) {

    //
    // Sanitize user input
    //

    var questionId = req.params.question
    var token      = req.headers.token

    if (ShallowValidator.sendError(res,
      ShallowValidator.questionId(questionId))) { return }

    //
    // Process request
    //

    // 2nd param is question object
    Question.get(token, questionId, function(err, question) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send(
          { code     : 200
          , message  : 'Here\'s the question.'
          , title    : question.title
          , answers  : question.answers
          , userVote : question.userVote

          // Don't return author
          // Don't return creationDate
          }
        )
      }
    })
  }

  function handleQuestionVote(req, res) {

    //
    // Sanitize user input
    //

    var token         = req.headers.token
      , questionId    = req.params.question
      , storyPrettyId = req.body.story
      , answer        = req.body.answer

    if (ShallowValidator.sendError(res,
      ShallowValidator.token        (token        ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.questionId   (questionId   ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.storyPrettyId(storyPrettyId))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.answer       (answer       ))) { return }

    //
    // Process request
    //

    // Callback only returns error.
    Question.vote(token, questionId, answer, storyPrettyId, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send(
          { code    : 200
          , message : 'Voted.'
          }
        )
      }
    })

  }

  router.post('/',               handleQuestionCreate)
  router.get ('/:question',      handleQuestionFetch)
  router.post('/:question/vote', handleQuestionVote)
}
