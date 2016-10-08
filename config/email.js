'use strict';

var nodemailer = require('nodemailer')

var MAIN_EMAIL_ADDRESS = process.env.DYNAMICSTORY_FEEDBACK_EMAIL_ADDRESS ||
  'The DynamicStory Team <contact@dynamicstory.org>'
var SMTP_USERNAME = process.env.DYNAMICSTORY_SMTP_USERNAME ||
  'dynamicstory@fastmail.com'
var SMTP_PASSWORD = process.env.DYNAMICSTORY_SMTP_PASSWORD

// Is SMTP setup correctly?
var isSmtpOk = false

// Use SMTP transport for email (nodemailer can also do Amazon SES, etc)
var Smtp = nodemailer.createTransport(
  { service: 'fastmail' // Configure to connect to FastMail's SMTP servers.
  , auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD }
  }
)

if (MAIN_EMAIL_ADDRESS && SMTP_USERNAME && SMTP_PASSWORD) {
  isSmtpOk = true
} else {
  // SMTP is not configured.  We cannot send emails on user feedback.
  if (process.env.NODE_ENV === 'production') {
    // Production environments *require* SMTP working.  Throw an error.
    throw new Error('SMTP configuration required for emails.')
  } else {
    // Integration testing will not work, so give a warning.
    console.trace('Warning: SMTP not configured. Cannot handle emails.')
  }
}

var Config =
{ mainAddress : MAIN_EMAIL_ADDRESS
, mainUsername: SMTP_USERNAME
, mainPassword: SMTP_PASSWORD
, Smtp        : Smtp
, isSmtpOk    : isSmtpOk
}

module.exports = Config
