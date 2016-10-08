
module.exports = function(router) {

  'use strict';

  var validator = require('validator')

  var ShallowValidator = require('./shallow_validator')

  var Feedback = require('../models/feedback.js')

  function handleFeedback(req, res) {

    //
    // Sanitize user input
    //

    var token     = req.headers.token
      , feedback  = req.body.feedback

    if (ShallowValidator.sendError(res,
      ShallowValidator.token   (token   ))) { return }
    if (ShallowValidator.sendError(res,
      ShallowValidator.feedback(feedback))) { return }

    //
    // Process request
    //

    // The session gets checked here because we grab the user's username and
    // email before delivering the message.
    Feedback.giveFeedback(token, feedback, function(err) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        res.send({ code: 200, message: 'Thanks for your feedback!' })
      }
    })

  }

  router.post('/', handleFeedback)
}
