'use strict';

var async    = require('async')
  , mongoose = require('mongoose')

var Db = require('./database')

var DSError = require('../error')

var ObjectId = mongoose.Schema.ObjectId

// The 'storyPrettyId' field is never read... but we keep track of it anyway.
//
// The 'isLatest' field is whether a vote is enabled or not.  Only the latest
// vote on a question by a user is active and counted.  However, we keep track
// of all votes they made.
var VoteSchema = mongoose.Schema(
    { userId        : {type: ObjectId, required: true}
    , questionId    : {type: ObjectId, required: true}
    , answer        : {type: Number,   required: true, min: 0, max: 4}
    , storyPrettyId : {type: Number,   required: true}
    , timestamp     : {type: Date,     required: true, default: Date.now}
    , isLatest      : {type: Boolean,  required: true, default: true}
    }
  )

var VoteMongoModel = Db.model('votes', VoteSchema)

/**
 * Register a user's vote on a specified question.  Does not check for
 * duplicates.  Does not check that parameters are valid.
 *
 * @param {ObjectId} userId user who is voting
 * @param {ObjectId} questionId question that is being voted on
 * @param {Number} answer vote choice from 0-4
 * @param {Number} storyPrettyId story from where question is being voted on
 * @param {Function} callback takes (1) DSError
 * @return nothing
 */
function createVote(userId, questionId, answer, storyPrettyId, callback) {
  VoteMongoModel.create(
    { userId        : userId
    , questionId    : questionId
    , answer        : answer
    , storyPrettyId : storyPrettyId
    }
  , function(err) {
      callback(DSError.wrapMongoError(err))
    }
  )
}

/**
 * Delete a user's vote on a specific question.  Does not check that
 * parameters are valid.
 *
 * @param {ObjectId} userId user whose vote we're deleting
 * @param {ObjectId} questionId question that was voted on
 * @param {Function} callback takes (1) DSError
 * @return nothing
 */
function deleteVote(userId, questionId, callback) {
  // Just mark the latest vote as "not latest" so it won't be used anymore.
  VoteMongoModel
    .findOneAndUpdate({ userId: userId, questionId: questionId, isLatest: true }
    , { isLatest: false })
    .select('_id')
    .exec(function(err) {
      callback(DSError.wrapMongoError(err))
    })
}

/**
 * Register a user's vote on a specified question.  Does not check that
 * parameters are valid.
 *
 * @param {String} userId user who is voting
 * @param {String} questionId question to be voted on
 * @param {Number} answer vote choice from 0-4
 * @param {Number} storyPrettyId story from where question is being voted on
 * @param {Function} callback takes (1) DSError
 * @return nothing
 */
function castVote(userId, questionId, answer, storyPrettyId, callback) {
  // Does the vote already exist?
  getVote(userId, questionId, function(err, vote) {
    if (err) {
      // DB lookup failed.
      callback(err) // already DSError
    } else if (!vote) {
      // The user has not voted on this question before.  Create new vote.
      createVote(userId, questionId, answer, storyPrettyId, callback)
    } else {
      // The user has voted on this before.  Change vote.
      async.parallel(
        [ function(next) {
            deleteVote(userId, questionId, next)
          }
        , function(next) {
            createVote(userId, questionId, answer, storyPrettyId, next)
          }
        ]
      , callback // already DSError
      )
    }
  })
}

/**
 * Fetch a user's vote on a specific question.  Does not check that parameters
 * are valid.
 *
 * @param {ObjectId} userId user whose vote we're looking for
 * @param {ObjectId} questionId question that was voted on
 * @param {Function} callback takes (1) DSError (2) vote
 * @return nothing
 */
function getVote(userId, questionId, callback) {
  VoteMongoModel
    .findOne({ userId: userId, questionId: questionId, isLatest: true })
    .select('_id answer')
    .exec(function(err, vote) {
      callback(DSError.wrapMongoError(err), vote)
    })
}

/**
 * Count the votes for the answers on a specific question.  Returns an array
 * with all zeros if the question does not exist.
 *
 * @param {ObjectId} questionId question that was voted on
 * @param {Function} callback takes two arguments:
 *                     (1) {DSError} error
 *                     (2) {Array} count of votes for each answer
 * @return nothing
 */
var countVotesOnQuestion = function(questionId, callback) {
  VoteMongoModel
    .find({ questionId: questionId, isLatest: true })
    .select('-_id answer')
    .exec(function(err, votes) {
      var count = [0, 0, 0, 0, 0]
      if (votes) {
        for (var i in votes) {
          var vote = votes[i]
          var answer = vote.answer
          count[answer]++
        }
      }
      callback(DSError.wrapMongoError(err), count)
    }
  )
}

var VoteModel =
  { cast  : castVote
  , count : countVotesOnQuestion
  , get   : getVote
  }

module.exports = VoteModel
