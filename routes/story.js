module.exports = function(router) {

  'use strict';

  var validator = require('validator')

  var ShallowValidator = require('./shallow_validator')

  var Story = require('../models/story')

  function handleStoryCreate(req, res) {
    var token       = req.headers.token
      , title       = req.body.title
      , narrative   = req.body.narrative
      , questionId  = req.body.question

    //
    // Sanitize user input
    //

    if (ShallowValidator.sendError(res,
      ShallowValidator.token     (token     ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.storyTitle(title     ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.narrative (narrative ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.questionId(questionId))) { return }

    //
    // Process request
    //

    Story.create(
      token
    , title
    , narrative
    , questionId
    , function(err, storyPrettyId) {
        if (err) {
          err.printIfInternal()
          res.send(err.result)
        } else {
          res.send(
            { code:    200
            , message: 'Story created.'
            , story:   storyPrettyId
            }
          )
        }
      }
    )

  }

  function handleStoryFetch(req, res) {

    var storyPrettyId = req.params.story

    //
    // Sanitize user input
    //

    if (ShallowValidator.sendError(res,
      ShallowValidator.storyPrettyId(storyPrettyId))) { return }

    storyPrettyId = parseInt(storyPrettyId)

    //
    // Process request
    //

    Story.get(storyPrettyId, function(err, story) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        // story guaranteed to be valid.
        res.send(
          { code         : 200
          , message      : 'Here\'s your story.'
          , title        : story.title
          , narrative    : story.narrative
          , author       : story.author
          , creationDate : story.creationDate
          , question     : story.question
          }
        )
      }
    })

  }

  function handleStoryDelete(req, res) {

    var token         = req.headers.token
      , storyPrettyId = req.params.story

    //
    // Sanitize user input
    //

    if (ShallowValidator.sendError(res,
      ShallowValidator.token        (token        ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.storyPrettyId(storyPrettyId))) { return }

    storyPrettyId = parseInt(storyPrettyId)

    //
    // Process request
    //

    Story.delete(token, storyPrettyId, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send({ code: 200, message: 'Story deleted.' })
      }
    })

  }

  router.post  ('/',       handleStoryCreate)
  router.get   ('/:story', handleStoryFetch)
  router.delete('/:story', handleStoryDelete)
}
