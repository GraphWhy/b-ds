'use strict';

var Stories = require('./story')

var Config  = require('../config/constants')

function getFeed(page, callback) {
  Stories.mostRecentlyCreated(page, Config.Feed.len, callback)
}

var FeedModel =
  { get : getFeed
  }

module.exports = FeedModel
