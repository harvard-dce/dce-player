var test = require('tape');
var dce-player = require('../index');

var testCases = [
  {
    opts: {
    },
    expected: {
    }
  },
  {
    opts: {
    },
    expected: {
    }
  }
];

testCases.forEach(runTest);

function runTest(testCase) {
  test('Basic test', function basicTest(t) {
    t.end();
  });
}
