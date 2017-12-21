'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Watch for situations when the node process is about to exit but the connection buffers are still
 * non-empty for some connections.
 *
 * @ignore
 */
var ConnectionTracker = function () {
  function ConnectionTracker() {
    _classCallCheck(this, ConnectionTracker);

    this.activeConnections = {};
    this.connectionIdGenerator = 0;
    this.registerShutdownHook();
  }

  _createClass(ConnectionTracker, [{
    key: 'registerShutdownHook',
    value: function registerShutdownHook() {
      var _this = this;

      process.on('exit', function () {
        _.forOwn(_this.activeConnections, function (connection) {
          connection.onProcessExit();
        });
      });
    }
  }, {
    key: 'generateConnectionID',
    value: function generateConnectionID() {
      var id = this.connectionIdGenerator;
      this.connectionIdGenerator += 1;
      return id;
    }
  }, {
    key: 'startTracking',
    value: function startTracking(connection) {
      this.activeConnections[connection.connectionId] = connection;
    }
  }, {
    key: 'stopTracking',
    value: function stopTracking(connection) {
      delete this.activeConnections[connection.connectionId];
    }
  }]);

  return ConnectionTracker;
}();

exports.default = new ConnectionTracker();
module.exports = exports['default'];