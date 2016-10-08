'use strict';

var async  = require('async')
  , extend = require('util')._extend
  , mocha  = require('mocha')

var API  = require('./api')
  , util = require('./util')

var describe = mocha.describe
  , it       = mocha.it

function repeat(str, n) {
  return new Array(n + 1).join(str)
}

function create() {
  var unique = util.randomString()
  return API.user.create()
    .with('username', unique)
    .with('email',    unique + '@example.com')
    .with('password', unique)
}

function notIdempotent(done, request, changes) {
  var first = request
    , second = extend(first.clone(), changes)
  async.series([first.should.succeed(), second.should.fail()], done)
}

describe('User creation', function() {
  it('works', function(done) {
    create().expect('token').should.succeed(done)
  })
  it('requires a username', function(done) {
    create().without('username').should.fail(done)
  })
  it('requires an email', function(done) {
    create().without('email').should.fail(done)
  })
  it('requires a password', function(done) {
    create().without('password').should.fail(done)
  })
  it('requires a non-blank username', function(done) {
    create().with('username', '').should.fail(done)
  })
  it('requires a non-blank email', function(done) {
    create().with('email', '').should.fail(done)
  })
  it('requires a non-blank password', function(done) {
    create().with('password', '').should.fail(done)
  })
  it('requires a valid username', function(done) {
    create().with('username', '☺').should.fail(done)
  })
  it('requires a valid email', function(done) {
    create().with('email', 'user@invalid').should.fail(done)
  })
  it('has a min username length', function(done) {
    create().with('username', 'a').should.fail(done)
  })
  it('has a max username length', function(done) {
    create().with('username', repeat('a', 30)).should.fail(done)
  })
  it('has a max email length', function(done) {
    var email = repeat('a', 300) + '@example.com'
    create().with('email', email).should.fail(done)
  })
  it('has a max password length', function(done) {
    create().with('password', repeat('a', 1000)).should.fail(done)
  })
  it('fails on duplicate username', function(done) {
    notIdempotent(done, create(), {email: util.randomString() + '@example.com'})
  })
  it('fails on duplicate email', function(done) {
    notIdempotent(done, create(), {username: util.randomString()})
  })
})
