'use strict';

var Async     = require('async')
  , Express   = require('express')
  , Mongoose  = require('mongoose')
  , Validator = require('validator')

var Conf      = require('./config/id-server')

var Db        = require('./models/database')


// Collection with zero or one items in it.  Stored in the same database as the
// stories themselves.
var PrettyIdCounterMongoModel = Db.model('prettyIdCounter', { value: Number })


// Get the next pretty ID from the database.
function getNextPrettyId(task, callback) {

  // Parameter 'task' not used.

  PrettyIdCounterMongoModel
    .findOneAndUpdate({}, {$inc: {value: 1}})
    .exec(function(err, nextPrettyId) {
      if (err) {
        callback(err)
        return
      }

      if (!nextPrettyId) {
        // Collection was empty.  Add a document to the collection.  The
        // current pretty ID will be 1 and the next will be 2.  We store the
        // value 2 here, not 1, because when we execute the read & update
        // above, we receive the value before it is updated.
        PrettyIdCounterMongoModel.create(
          { value: 2 }
        , function(err) {
            callback(err, 1)
          }
        )
        return
      }

      // value does not include the increment by 1.
      var value = nextPrettyId.value

      if (!value) {
        callback(new Error('Next pretty ID record did not contain a value.'))
        return
      }

      if (!Validator.isInt(value) || value < 1) {
        callback(new Error('Next pretty ID not a natural number.'))
        return
      }

      // Everything went okay.
      callback(null, value)

    })

}

var nextPrettyIdQueue = Async.queue(getNextPrettyId, 1)



var app = Express()

app.post(Conf.path, function(req, res) {
  nextPrettyIdQueue.push(null, function(err, prettyId) {
    if (err) {
      throw err
    } else {
      res.send('' + prettyId)
    }
  })
})

app.use(function(err, req, res, next) {
  if (err) {
    console.error('Uncaught exception in route handler - ' + err.stack)
    res.status(500).send('500')
  } else {
    res.status(404).send('404')
  }
})

var server = app.listen(Conf.port, Conf.host, function() {
  var host = server.address().address // Could be different.
    , port = server.address().port
  console.log('Dynamic Story pretty ID server at http://%s:%s', host, port)
})
