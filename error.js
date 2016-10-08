'use strict';

var MONGO_ERROR_MESSAGE = 'Something went wrong in the database.'

var DSError = {}

DSError.ClientError = function(message) {
  this.message  = message
  this.source   = new Error('new ClientError')
  this.result   =
    { code    : 400
    , message : message
    }
}

DSError.ServerError = function(message, err) {
  this.message  = message
  this.source   = new Error('new ServerError')
  this.cause    = err
  this.result   =
    { code    : 500
    , message : message
    }
}

DSError.wrapMongoError = function(err) {
  if (err) {
    return new DSError.ServerError(MONGO_ERROR_MESSAGE, err)
  } else {
    return null
  }
}

DSError.mongoCallback = function(callback) {
  return function(err, docs) {
    callback(DSError.wrapMongoError(err), docs)
  }
}

DSError.fromDocumentShouldExist = function(err, doc, didntExistMsg) {
  if (err) {
    return new DSError.ServerError(MONGO_ERROR_MESSAGE, err)
  } else if (!doc) {
    // Document *should* exist, but it doesn't in this case.  Throw an error!
    return new DSError.ClientError(didntExistMsg)
  } else {
    return null
  }
}

DSError.fromDocumentShouldntExist = function(err, doc, didExistMsg) {
  if (err) {
    return new DSError.ServerError(MONGO_ERROR_MESSAGE, err)
  } else if (doc) {
    // Document *shouldn't* exist, but it does in this case.  Throw an error!
    return new DSError.ClientError(didExistMsg)
  } else {
    return null
  }
}

// ClientError still has a printIfInternal member function.
DSError.ClientError.prototype.printIfInternal = function() {
  // Don't do anything because we don't need to print client errors.
}

DSError.ServerError.prototype.printIfInternal = function() {

  // Show the error.
  if (this.cause instanceof Error) {
    console.error('[1/2] DynamicStory internal error: ', this.cause.stack)
  } else {
    // Sometimes we may have been passed a non-Error object.  These are
    // probably bugs, but let's try to handle them as best as we can.
    console.error('[1/2] DynamicStory internal error: ' +
                  'Non-error object passed as err: ', this.cause)
  }

  // Show where the error occurred from within DynamicStory code, in case the
  // error originates from a third party library.
  console.error('[2/2] Error source: ', this.source.stack)

}

module.exports = DSError
