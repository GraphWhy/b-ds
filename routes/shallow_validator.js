'use strict';

var validator = require('validator')

var DSError = require('../error')

var Config  = require('../config/constants')


/*
 * Note:
 * Throughout this file, string lengths are checked via validator's isLength
 * function because it counts characters.  Node's length property on strings
 * only counts bytes.
 */

/**
 * Finds a duplicate in the array.
 *
 * @param {Array} an array of primitives
 * @returns {Object} if a duplicate exists, an element that was found at least
 *                   twice, and the number of occurrences it made in the array,
 *                   otherwise, null
 */
function findDuplicate(arr) {
  var set = {}
  for (var i in arr) {
    var elem = arr[i]
    if (elem in set) {
      set[elem]++
    } else {
      set[elem] = 1
    }
  }
  for (var elem in set) {
    if (set[elem] > 1) {
      return {value: elem, occurrences: set[elem]}
    }
  }
  return null
}

function validateToken(token) {
  var tokenRegexp = /^[A-Za-z0-9+\/]{342}==$/

  if (!token) {
    return new DSError.ClientError('You are not currently logged in.')
  }
  if (!tokenRegexp.test(token)) {
    return new DSError.ClientError('That is not a valid authentication token.')
  }
  return null
}


function validateUsername(username) {
  var usernameRegexp = /^[a-zA-Z0-9-_]+$/

  if (!username) {
    return new DSError.ClientError('Username field cannot be empty.')
  }

  if (!validator.isLength(username, Config.User.usernameMinLen)) {
    return new DSError.ClientError('Username must be at least ' +
      Config.User.usernameMinLen + ' characters.')
  }

  if (validator.isLength(username, Config.User.usernameMaxLen + 1)) {
    return new DSError.ClientError('Username field cannot be more than ' +
      Config.User.usernameMaxLen + ' characters.')
  }


  if (!usernameRegexp.test(username)) {
    return new DSError.ClientError('Username can only contain letters, ' +
                                  'numbers, dashes, and underscores.')
  }

  return null
}

function validateEmail(email) {

  if (!email) {
    return new DSError.ClientError('Email field cannot be empty.')
  }

  if (!validator.isEmail(email)) {
    return new DSError.ClientError('That is not a valid email.')
  }

  if (validator.isLength(email, Config.User.emailMaxLen + 1)) {
    return new DSError.ClientError('Email is too long.')
  }

  return null

}

function validatePassword(password) {
  if (!password) {
    return new DSError.ClientError('Password field cannot be empty.')
  }

  if (!validator.isLength(password, Config.User.passwordMinLen)) {
    return new DSError.ClientError('Password must be at least ' +
      Config.User.passwordMinLen + ' characters.')
  }

  if (validator.isLength(password, Config.User.passwordMaxLen + 1)) {
    return new DSError.ClientError('Password is too long.')
  }

  return null

}

function validateUsernameEmail(usernameEmail) {

  if (!usernameEmail) {
    return new DSError.ClientError('Username/Email field cannot be empty.')
  }

  // Whichever is greater.
  var maxLen = Math.max(Config.User.emailMaxLen, Config.User.usernameMaxLen) + 1
  if (validator.isLength(usernameEmail, maxLen + 1)) {

    return new DSError.ClientError('Username/Email is too long.')
  }

  return null
}

function validateStoryTitle(title) {
  if (!title) {
    return new DSError.ClientError('Story title missing.')
  }

  if (!validator.isLength(title, Config.Story.titleMinLen)) {
    return new DSError.ClientError('Story title must be at least ' +
      Config.Story.titleMinLen + ' characters.')
  }

  if (validator.isLength(title, Config.Story.titleMaxLen + 1)) {
    return new DSError.ClientError('Story title cannot be more than ' +
      Config.Story.titleMaxLen + ' characters.')
  }

  // TODO: Add more checks for valid story titles.

  return null
}

function validateNarrative(narrative) {
  if (!narrative) {
    return new DSError.ClientError('Story narrative missing.')
  }

  // validator's isLength function counts characters.  Node's length property
  // on strings counts bytes, so we shouldn't use that here.
  if (!validator.isLength(narrative, Config.Story.narrativeMinLen)) {
    return new DSError.ClientError('Story narratives must be at least ' +
      Config.Story.narrativeMinLen + ' characters. This is to help ensure ' +
      'quality discussions.') }

  if (validator.isLength(narrative, Config.Story.narrativeMaxLen + 1)) {
    return new DSError.ClientError('Story narratives cannot be more than ' +
      Config.Story.narrativeMaxLen + ' characters.')
  }

  // TODO: Add more checks for valid story narratives.

  return null
}

function validateQuestionId(questionId) {
  if (!questionId) {
    return new DSError.ClientError('Question missing.')
  }

  if (!validator.isMongoId(questionId)) {
    // Such a story would not be found.  Don't bother doing a DB lookup.
    return new DSError.ClientError('Question not found.')
  }

  return null
}

function validateStoryPrettyId(storyPrettyId) {
  if (!storyPrettyId) {
    return new DSError.ClientError('Story missing.')
  }

  if (!validator.isInt(storyPrettyId)) {
    // Such a story would not be found.  Don't bother doing a DB lookup.
    return new DSError.ClientError('Story not found.')
  }
  var value = validator.toInt(storyPrettyId)
  if (value < 1) {
    return new DSError.ClientError('Stories start at number 1.')
  }

  return null
}

function validateQuestionTitle(title) {
  if (!title) {
    return new DSError.ClientError('Question Title missing.')
  }

  if (!validator.isLength(title, Config.Question.titleMinLen)) {
    return new DSError.ClientError('Question title must be at least ' +
      Config.Question.titleMinLen + ' characters.')
  }

  if (validator.isLength(title, Config.Question.titleMaxLen + 1)) {
    return new DSError.ClientError('Question title cannot be more than ' +
      Config.Question.titleMaxLen + ' characters.')
  }

  // TODO: Add more checks for valid question titles.

  return null
}


function validateAnswer(answer) {
  if (!answer) {
    return new DSError.ClientError('Answer field cannot be empty.')
  }
  if (!validator.isInt(answer)) {
    return new DSError.ClientError('Answer must be an int.')
  }
  var value = validator.toInt(answer)
  if (value < 0 || 4 < value) {
    return new DSError.ClientError('Answer must be between 0 and 4.')
  }
  return null
}

function validateAnswers(answers) {
  if (!answers) {
    return new DSError.ClientError('Answers field cannot be empty.')
  }
  if (!Array.isArray(answers)) {
    return new DSError.ClientError('Answers must be an array.')
  }
  for (var i = 0; i < 5; i++) {
    if (!answers[i]) {
      return new DSError.ClientError('Answers field must have five elements.')
    }
  }
  var dup = findDuplicate(answers)
  if (dup) {
    var message
    if (dup.occurrences === 2) {
      message = 'You have two answers labeled "' + dup.value + '." ' +
                'Please change one.'
    } else {
      message = 'You have several answers labeled "' + dup.value + '." ' +
                'Please make them different.'
    }
    return new DSError.ClientError(message)
  }
  return null
}

function validateFeedback(feedback) {
    if (!feedback) {
      return new DSError.ClientError('Feedback field cannot be empty.')
    }

    // validator's isLength function counts characters.  Node's length property
    // on strings counts bytes, so we shouldn't use that here.
    if (!validator.isLength(feedback, Config.Feedback.feedbackMinLen)) {
      return new DSError.ClientError('Feedback must be at least ' +
        Config.Feedback.feedbackMinLen + ' characters.')
    }
    return null
  }

function validateActivationId(activationId) {
  if (!activationId) {
    return new DSError.ClientError('Activation ID not found.')
  }
  if (!validator.isAlphanumeric(activationId)) {
    return new DSError.ClientError('Activation ID not found.')
  }
  return null
}


function validatePage(page) {
  if (!page) {
    return new DSError.ClientError('Not found.')
  }
  if (!validator.isInt(page)) {
    return new DSError.ClientError('Not found.')
  }
  return null
}

function sendError(res, err) {
  if (err) {
    res.send(err.result)
    return true
  } else {
    return false
  }
}

var ShallowValidateModel =
{ username      : validateUsername
, email         : validateEmail
, password      : validatePassword
, usernameEmail : validateUsernameEmail
, token         : validateToken
, storyTitle    : validateStoryTitle
, narrative     : validateNarrative
, questionId    : validateQuestionId
, storyPrettyId : validateStoryPrettyId
, questionTitle : validateQuestionTitle
, answer        : validateAnswer
, answers       : validateAnswers
, feedback      : validateFeedback
, activationId  : validateActivationId
, page          : validatePage
, sendError     : sendError
}

module.exports = ShallowValidateModel;
