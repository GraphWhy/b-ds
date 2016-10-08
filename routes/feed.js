'use strict';

module.exports = function(router) {

  var Feed = require('../models/feed')

  var ShallowValidator = require('./shallow_validator')

  function handleFeed(req, res) {

    var page = parseInt(req.params.page)

    if (ShallowValidator.sendError(res,
      ShallowValidator.page(page))) { return }

    Feed.get(page, function(err, feed, lastPage) {
      if (err) {
        err.printIfInternal()
        res.send(err.result)
      } else {
        // feed is not null.
        res.send(
          { code    : 200
          , message : 'Here\'s what\'s trending.'
          , feed    : feed
          , lastPage: lastPage
          }
        )
      }
    })
  }

  router.get('/:page', handleFeed)

}
