'use strict';

var async     = require('async')
  , crypto    = require('crypto')
  , mongoose  = require('mongoose')
  , request   = require('request')
  , validator = require('validator')
  , _         = require('lodash')

var Db        = require('./database')
  , Session   = require('./session')
  , User      = require('./user')
  , Vote      = require('./vote')

var Config    = require('../config/constants')

var DSError   = require('../error')

var IdServer  = require('../config/id-server.js')

var ObjectId  = mongoose.Schema.ObjectId

var StorySchema = mongoose.Schema(
  { prettyId     : {type: Number,   required: true, unique: true}
  , owner        : {type: ObjectId, required: true}
  , title        : {type: String,   required: true}
  , narrative    : {type: String,   required: true}
  , question     : {type: ObjectId, required: true}
  , creationDate : {type: Date,     required: true, default: Date.now}
  }
)

StorySchema.path('title').validate(
  function(title) {
    // validator's isLength function counts characters.  Node's length property
    // on strings counts bytes, so we shouldn't use that here.

    return validator.isLength(title, Config.Story.titleMinLen) &&
          !validator.isLength(title, Config.Story.titleMaxLen + 1)
  }
, 'Story title does not meet length requirements.'
)

StorySchema.path('narrative').validate(
  function(narrative) {
    return validator.isLength(narrative, Config.Story.narrativeMinLen) &&
          !validator.isLength(narrative, Config.Story.narriveMaxLen + 1)
  }
, 'Story narrative does not meet length requirements.'
)

var StoryMongoModel = Db.model('stories', StorySchema)

function createStory(token, title, narrative, questionId, callback) {

  async.waterfall(
    [ function(next) {
        Session.getUser(token, next)
      }
    , function(owner, next) {
        request(IdServer, function(err, res, body) {
          var prettyId = parseInt(body)
          if (err) {
            next(DSError.ServerError('Internal server error', err))
          } else if (res.statusCode !== 200) {
            next(DSError.ServerError(
              'Internal server error'
            , new Error('Pretty ID server gave error')
            ))
          } else if (!body) {
            next(DSError.ServerError(
              'Internal server error'
            , new Error('Pretty ID server gave empty response')
            ))
          } else if (prettyId < 1) {
            next(DSError.ServerError(
              'Internal server error'
            , new Error('Pretty ID server gave non-whole number response')
            ))
          } else {
            next(null, owner, prettyId)
          }
        })
      }
    , function(owner, prettyId, next) {
        StoryMongoModel.create(
          { prettyId  : prettyId
          , owner     : owner
          , title     : title
          , narrative : narrative
          , question  : questionId
          }
        , function(err, story) {
            next(DSError.wrapMongoError(err), prettyId)
          }
        )
      }
    ]
  , function(err, prettyId) {
      callback(err, prettyId) // Already DSError
    }
  )

}


function fetchStory(prettyId, callback) {

  // Although our database schema holds an 'owner' field, we have to return an
  // 'author' field from here.
  async.waterfall(
    [ function(next) {
        StoryMongoModel
          .findOne({ prettyId: prettyId })
          .select('-_id owner title narrative creationDate question')
          .exec(function(err, story) {
            next(
              DSError.fromDocumentShouldExist(
                err, story, 'Story doesn\'t exist.'
              )
            , story
            )
          })
      }
    , function(story, next) {
        User.getById(story.owner, function(err, owner) {
          if (owner) {
            story.author = owner.username
          }
          next(err, story)
        })
      }
    ]
  , callback
  )

}


// Calls back with an error if the story doesn't exist.  Calls back with null
// if the story exists.
function storyExists(prettyId, callback) {

  StoryMongoModel
    .findOne({ prettyId: prettyId })
    .select('_id')
    .exec(function(err, story) {
      callback(DSError.fromDocumentShouldExist(
        err, story, 'Story doesn\'t exist.'
      ))
    })

}


function deleteStory(token, prettyId, callback) {

  async.waterfall(
    [ function(next) {
        Session.getUser(token, next)
      }
    , function(userId, next) {
        StoryMongoModel
          .findOne({ prettyId: prettyId })
          .exec(function(err, story) {
            next(DSError.wrapMongoError(err), userId, story)
          })
      }
    ]
  , function(err, userId, story) {

      if (err) {
        return callback(err) // Already DSError
      } else if (!story) {
        return callback(
          new DSError.ClientError('Story doesn\'t exist.')
        )
      } else {

        if (!story.owner.equals(userId)) {
          return callback(
            new DSError.ClientError('You are not the question owner.')
          )
        }

        story.remove(function(err) {
          callback(DSError.wrapMongoError(err))
        })

      }

    }
  )

}

function countStories(callback) {
  StoryMongoModel.count(DSError.mongoCallback(callback))
}

function fetchStoriesSlice(skip, limit, callback) {
  StoryMongoModel
    .find()
    .sort('-creationDate')
    .skip(skip)
    .limit(limit)
    .select('prettyId owner title narrative question creationDate')
    .exec(DSError.mongoCallback(callback))
}

function getUsernames(stories, callback) {
  var ownerIds = _.pluck(stories, 'owner')
  User.getSetByIds(ownerIds, function(err, ownerSet) {
    // ownerSet will be smaller than ownerIds if there are duplicates in
    // ownerIds.  However, we don't want this.  Create an array of
    // usernames in the same order as ownerIds, preserving duplicates.
    var usernames = ownerIds.map(function (ownerId) {
      var owner = _.find(ownerSet, function(owner) {
        return owner._id.equals(ownerId)
      })
      return owner.username
    })
    callback(err, usernames)
  })
}

function mostRecentlyCreatedStories(page, limit, callback) {

  async.waterfall(
    [ function(next) {
        async.parallel(

          // README: Do not remove this function or else!!!
          { count: function(next) {
              StoryMongoModel.count(next)
            }
          , stories: function(next) {
              fetchStoriesSlice(limit * (page - 1), limit, next)
            }
          }
        , next
        )
      }
    , function(results, next) {
        getUsernames(results.stories, function(err, usernames) {
          results.usernames = usernames
          next(err, results)
        })
      }
    ]
  , function(err, results) {
      if (err) {
        callback(err)
      } else {
        var lastPage = Math.ceil(results.count / limit)

        var stories = results.stories.map(function(story, i) {
          return { story        : story.prettyId
                 , author       : results.usernames[i]
                 , title        : story.title
                 , narrative    : story.narrative
                 , question     : story.question
                 , creationDate : story.creationDate
                 }
        })

        callback(null, stories, lastPage)
      }
    }
  )
}


var StoryModel =
  { create              : createStory
  , get                 : fetchStory
  , exists              : storyExists
  , delete              : deleteStory
  , mostRecentlyCreated : mostRecentlyCreatedStories
  }

module.exports = StoryModel
