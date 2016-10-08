'use strict';

var mongoose = require('mongoose')

var MongoConfig = require('../config/mongo')

var db = mongoose.createConnection()

// Initialize Connection to MongoDB
db.open(
  MongoConfig.address, MongoConfig.db, MongoConfig.port, MongoConfig.options
)

// Let's check to see if the app has successfully connected to the DB.
db.on('error', function(err) {
  throw err
})
db.once('open', function() {
  console.log('Connection to DB established')
})

module.exports = db
