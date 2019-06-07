const Bot = require('./lib/Bot');
const Config = require('./lib/Config');
const logger = require('winston');
const Youtube = require('./lib/Widget/Youtube');
const path = require('path');

const configuration = require('./config.json');
const config = Config(configuration, path.resolve(__dirname, 'config.json'));

const bot = Bot(config);
bot.registerWidget('youtube', Youtube(config, bot));
bot.run()
  .then(() => {

  })
  .catch((err) => {
    logger.error('Error starting Schnautzebot!', err)
  })
