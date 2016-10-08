'use strict';

function randomString() {
  return Math.random() // Random float from [0,1)
    .toString(36)      // Base36 uses digits 0-9 and letters a-z
    .substring(2)      // Stripping the initial '0.' prefix
}

module.exports =
  { randomString: randomString
  }
