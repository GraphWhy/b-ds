'use strict';

  /* "When you are hashing your data the module will go through a series of
   *  rounds to give you a secure hash. The value you submit there is not just
   *  the number of rounds that the module will go through to hash your data.
   *  The module will use the value you enter and go through 2^rounds iterations
   *  of processing.
   *
   * "On a 2GHz core you can roughly expect:
   *
   * "rounds=10: ~10 hashes/sec
   *  rounds=13: ~1 sec/hash
   *  rounds=25: ~1 hour/hash
   *  rounds=31: 2-3 days/hash"
   *
   * @see https://www.npmjs.com/package/bcrypt
   */

var BCRYPT_SALT_ROUNDS  = 10
  , USER_NAME_MIN_LEN   = 3
  , USER_NAME_MAX_LEN   = 20

  // Email doesn't need min length.
  , USER_EMAIL_MAX_LEN    = 254
  , USER_PASSWORD_MIN_LEN = 5
  , USER_PASSWORD_MAX_LEN = 512
  , ACTIVATION_ID_NONCE_BYTES = 32

  // Story titles and narratives *probably* aren't good if they're shorter than
  // this many characters.
  , STORY_TITLE_MIN_LEN     = 10
  , STORY_NARRATIVE_MIN_LEN = 20

  // We impose a maximum character length to maintain sanity, usability, and
  // security.
  , STORY_TITLE_MAX_LEN     = 140
  , STORY_NARRATIVE_MAX_LEN = 100 * 1000

  , QUESTION_TITLE_MIN_LEN = 5
  , QUESTION_TITLE_MAX_LEN = 140
  , ANSWER_MIN_LEN = 1
  , ANSWER_MAX_LEN = 100

  // Max attempts to create a session
  , MAX_ATTEMPTS     = 5
  , RAND_NONCE_BYTES = 256

  // TTL is 2 days in milliseconds
  , SESSION_TTL = 1000 * 60 * 60 * 24 * 2

  // We only accept user feedback if it is at least this many characters.
  , MIN_FEEDBACK_LEN = 5

  , STORIES_IN_FEED = 40

var Config = {}

Config.User =
{ saltRounds            : BCRYPT_SALT_ROUNDS
, usernameMinLen        : USER_NAME_MIN_LEN
, usernameMaxLen        : USER_NAME_MAX_LEN
, emailMaxLen           : USER_EMAIL_MAX_LEN
, passwordMinLen        : USER_PASSWORD_MIN_LEN
, passwordMaxLen        : USER_PASSWORD_MAX_LEN
, activationIdNonceBytes: ACTIVATION_ID_NONCE_BYTES
}

Config.Story =
{ titleMinLen     : STORY_TITLE_MIN_LEN
, titleMaxLen     : STORY_TITLE_MAX_LEN
, narrativeMinLen : STORY_NARRATIVE_MIN_LEN
, narrativeMaxLen : STORY_NARRATIVE_MAX_LEN
}

Config.Question =
{ titleMinLen  : QUESTION_TITLE_MIN_LEN
, titleMaxLen  : QUESTION_TITLE_MAX_LEN
, answerMinLen : ANSWER_MIN_LEN
, answerMaxLen : ANSWER_MAX_LEN
}

Config.Session =
{ randNonceBytes: RAND_NONCE_BYTES
, ttl           : SESSION_TTL
}

Config.Feedback = { feedbackMinLen: MIN_FEEDBACK_LEN }

Config.Feed = { len: STORIES_IN_FEED }

Config.Misc = { nonceMaxAttempts: MAX_ATTEMPTS}

module.exports = Config
