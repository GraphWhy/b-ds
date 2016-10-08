'use strict';

var assert      = require('assert')
  , events      = require('events')
  , http        = require('http')
  , querystring = require('querystring')
  , util        = require('util')


var inProduction = process.env.NODE_ENV === 'production'
var backendPort = process.env.DS_PORT || (inProduction ? 33841 : 3000)


//
// HTTP requests
//

/**
 * Create an HTTP request for integration testing purposes.
 *
 * @constructor
 * @this {Request}
 * @extends {EventEmitter}
 */
function Request() {
  this.data = {}
  this.reply = null
  return this
}

util.inherits(Request, events.EventEmitter)

/**
 * Returns a clone of the current object.
 *
 * Clones can be useful for prototyping a common base Request and then making a
 * bunch of similar objects each with one or two small differences.
 *
 * @this {Request}
 * @return {Request} a clone of this
 */
Request.prototype.clone = function() {
  var clone = new Request()
  // Give each clone its own deep copy of `data` such that modifying a clone's
  // data does not touch any other clone's data.  Conversion into and out of a
  // JSON object is a quick and easy way to deep copy a plain-old-data JS
  // object.
  clone.data = JSON.parse(JSON.stringify(this.data))
  clone.method = this.method
  clone.path = this.path
  return clone
}

/**
 * Set the request HTTP method.
 *
 * @this {Request}
 * @param {String} method The HTTP method to use for the request.
 * @return {Request} this
 */
Request.prototype.method = function(method) {
  this.method = method
  return this
}

/**
 * Set the request URL path.
 *
 * @this {Request}
 * @param {String} path The HTTP URL path to use for the request.
 * @return {Request} this
 */
Request.prototype.path = function(path) {
  this.path = path
  return this
}

/**
 * Assign a request field.
 *
 * Example: with('usernameemail', 'user@example.com')
 *
 * @this {Request}
 * @param {String} key Field key.
 * @param {String} value Field value.
 * @return {Request} this
 */
Request.prototype.with = function(key, value) {
  this.data[key] = value
  return this
}

/**
 * Remove a request field after it has previously been set.
 *
 * @this {Request}
 * @param {String} key Field key to remove.
 * @return {Request} this
 */
Request.prototype.without = function(key) {
  delete this.data[key]
  return this
}

/**
 * Execute the HTTP request.
 *
 * On completion, the 'end' event is emitted, running any response expect
 * checks, codes checks, or nowOrLater callbacks.
 *
 * @this {Request}
 * @return {Request} this
 */
Request.prototype.exec = function() {
  var self = this

  var options =
    { port: backendPort
    , method: this.method
    , path: '/v1' + this.path
    , headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }

  var req = http.request(options)

  req.on('error', function(err) {
    self.emit('end', new Error('HTTP response error: ' + JSON.stringify(err)))
  })

  req.on('response', function(res) {

    // All valid API calls should return HTTP 200, even if their JSON response
    // body has {code: 400} or {code: 500}.
    if (res.statusCode !== 200) {
      self.emit(
        'end'
      , new Error('HTTP response status code: ' + res.statusCode)
      )
      return
    }

    var dataChunks = []
    res.on('readable', function() {
      var buffer = res.read()
      dataChunks.push(buffer)
    })

    res.on('end', function() {
      var data = Buffer.concat(dataChunks)
        , body = data.toString('utf-8')

      if (!body) {
        // The REST API specifies we should not get an empty response body.
        self.emit('end', new Error('HTTP response body empty'))
      } else {
        // Resolve with JSON contents of HTTP response body.
        // The reply should have `code` member of 200, 400, or 500.
        self.reply = JSON.parse(body)
        self.emit('end')
      }
    })
  })

  req.write(querystring.stringify(this.data))
  req.end()

  return this
}

/**
 * Assert that the response will have a certain field present.  If an optional
 * value is specified, too, then also check that the field holds the value
 * specified.
 *
 * @this {Request}
 * @param {String} field The response field to expect.
 * @param {String} value Optional value the field is expected to hold.
 * @return {Request} this
 */
Request.prototype.expect = function(field, value) {
  this.on('end', function(err) {
    if (err) {
      return
    }

    var reply = JSON.stringify(this.reply)

    assert.notStrictEqual(
      this.reply[field]
    , undefined
    , 'Reply should have ' + field + '. Server reply: ' + reply
    )

    if (value) {
      var pretty = JSON.stringify(value)
      assert.strictEqual(
        this.reply[field]
      , value
      , 'Reply should have ' + field + ' === ' + pretty + '. ' +
        'Server reply: ' + reply
      )
    }

  })
  return this
}

/**
 * Assert that the response will come back with the specified HTTP status code.
 *
 * @this {Request}
 * @param {Number} code The expected HTTP status code.
 * @return {Request} this
 */
Request.prototype.code = function(code) {
  this.on('end', function(err) {
    assert.ifError(err)
    var reply = JSON.stringify(this.reply)
    assert.strictEqual(
      this.reply.code
    , code
    , 'Reply should contain ' + code + ' code. Server reply: ' + reply
    )
  })
  return this
}

// Bind the 'should' property to the same object so that
// request.should.succeed() is functionally identical to request.succeed().
// Same with request.should.fail().
Object.defineProperty(Request.prototype, 'should', {
  get: function() { return this }
})

Request.prototype.succeed = function(next) {
  this.code(200)
  return this.nowOrLater(next)
}
Request.prototype.fail = function(next) {
  this.code(400)
  return this.nowOrLater(next)
}

/**
 * Run the request now or return a function to do it later.  If the parameter
 * 'next' is truthy, we run now and call next() when finished.  Otherwise we
 * return a function that will execute the request.
 *
 * @this {Request}
 * @param {Function} Optional callback to call if we run now.
 * @return {Function|undefined} undefined if we are running now,
 *                              else a function to run this request later on
 */
Request.prototype.nowOrLater = function(next) {
  if (next) {
    this.on('end', function(err) {
      assert.ifError(err)
      next()
    })
    this.exec()
  } else {
    var self = this
    return function(callback) {
      self.on('end', function(err) {
        callback(err, this.reply)
      })
      self.exec()
    }
  }
}


//
// DynamicStory REST API
//

function makeRequest(method, path) {
  return function() {
    return new Request().method(method).path(path)
  }
}

function makeRequestParam(method, pathTemplate) {
  return function(param) {
    var path = pathTemplate.replace('%', param)
    return new Request().method(method).path(path)
  }
}

var API =
  { user:
    { create: makeRequest('POST', '/user/')
    , del: makeRequest('DELETE', '/user')
    , authenticate: makeRequest('POST', '/user/authenticate')
    , reauthenticate: makeRequest('POST', '/user/reauthenticate')
    , logout: makeRequest('POST', '/user/logout')
    , updatePassword: makeRequest('PUT', '/user/password')
    }
  , feed: makeRequest('GET', '/feed')
  , story:
    { create: makeRequest('POST', '/story')
    , fetch: makeRequest('GET', '/story')
    , del: makeRequestParam('DELETE', '/story/%')
    }
  , question:
    { create: makeRequest('POST', '/question')
    , fetch: makeRequestParam('GET', '/question/%')
    , vote: makeRequestParam('POST', '/question/%/vote')
    }
  , feedback: makeRequest('POST', '/feedback')
  }

module.exports = API
