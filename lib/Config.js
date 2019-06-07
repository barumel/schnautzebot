const fs = require('fs-extra');
const _ = require('lodash');

function Config(config, path) {
  function has(key) {
    return _.has(config, key);
  }

  function get(key) {
    return _.get(config, key);
  }

  function set(key, value) {
    _.set(config, key, value);
    save();
  }

  function save() {
    fs.writeJsonSync(path, config, { spaces: 2 });
  }

  return {
    has,
    get,
    set
  };
}

module.exports = Config;
