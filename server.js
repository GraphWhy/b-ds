'use strict';

// TODO: Don't let the API run if the DB isn't connected

// Set the API Version here
var API_VERSION = 'v1'

// Include all our packages
var bodyParser  = require('body-parser')
  , express     = require('express')
  , path        = require('path')

var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Set up routers
var router          = express.Router()
  , routerUser      = express.Router()
  , routerStory     = express.Router()
  , routerQuestion  = express.Router()
  , routerFeed      = express.Router()
  , routerFeedback  = express.Router()

// Set variables that will change when in production
var serverPort = process.env.DS_PORT || 3000

if (app.get('env') === 'production') {
  serverPort = process.env.DS_PORT || 33841
} else if (app.get('env') === 'development') {

}

// Include the routes
require('./routes/user')(routerUser)
require('./routes/story')(routerStory)
require('./routes/question')(routerQuestion)
require('./routes/feed')(routerFeed)
require('./routes/feedback')(routerFeedback)

// Get our router to set the namespace
// /v1
app.use('/' + API_VERSION, router)

// /v1/user, /v1/feed, etc.
router.use('/user',     routerUser)
router.use('/story',    routerStory)
router.use('/question', routerQuestion)
router.use('/feed',     routerFeed)
router.use('/feedback', routerFeedback)

// Handle server exceptions
app.use(function(err, req, res, next) {
  if (err) {
    console.error('Uncaught exception in route handler - ' + err.stack)
    res.send(
      { code    : 500
      , message : 'Internal server error.'
      }
    )
    // Do not call next()
  } else {
    next()
  }
})

// Handle 404 Error
app.use(function(req, res, next) {
  res.status(404).send(
    { code: 404
    , message: 'Not found.'
    }
  )
})

var server = app.listen(serverPort, 'localhost', function () {

  var host = server.address().address
    , port = server.address().port

  console.log('Dynamic Story API listening at http://%s:%s in ' +
    '%s mode.', host, port, app.get('env'))

})
