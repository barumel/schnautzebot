const Discord = require('discord.io');
const logger = require('winston');
const fs = require('fs');
const Promise = require('bluebird');
const parse = require('yargs-parser');
const stringArgv = require('string-argv');
const _ = require('lodash');

function Bot(config) {
  let client;
  let voiceChannel;
  let audioContext;
  const widgets = {};

  const bot = {
    init,
    run,
    joinVoiceChannel,
    leaveVoiceChannel,
    getAudioContext,
    getChannelByName,
    sendMessage,
    registerWidget,
    unregisterWidget
  };

  const commands = {
    '--help': function(channelId) {
      sendMessage(channelId, `
        Available Commands:
        **--help**: Show this message
        **--list-widgets**: List all registered widgets
        **--<<WIDGET_NAME>> --help**: Show help for the given widget
      `);
    },
    '--list-widgets': function(channelId) {
      let message = 'Registered Widgets:';
      _.forEach(widgets, (widget, id) => {
        message = `
          ${id}
          ${_.isFunction(widget.getDescription) ? widget.getDescription() : 'No description available'}
        `;
      });

      sendMessage(channelId, message);
    }
  }

  async function init() {
    if (!!client) return Promise.resolve(client);

    logger.info('BOT: Schnautzebot is starting...')

    client = new Discord.Client({
       token: config.get('discord.token'),
       autorun: true
    });

    logger.remove(logger.transports.Console);
    logger.add(new logger.transports.Console, {
        colorize: true
    });

    return new Promise((resolve, reject) => {
      client.on('ready', (ev) => {
        logger.info('BOT: Successful connected to server!');

        logger.info('BOT: Na na na na na na na na na na na na na na na na Schnautzebot!')
        return resolve(ev);
      })
    });
  }

  /**
   * Execute the given command. Delegate to widget if a widget was passed
   *
   * @param  {String} channelId Channel id (request)
   * @param  {String} argString Arg string
   * @param  {Object} widget    Optional widget
   *
   * @return void
   */
   async function executeCommand(channelId, argString = '', widget) {
     if (argString.substring(0, 2) === '--') {
       const command = _.head(stringArgv.parseArgsStringToArgv(argString));
       const args = parse(argString.replace(command, '').trim());

       // If a widget was passed, delegate to widget, else execute the given command if exists
       if (widget) {
         return widget.executeCommand(command, args, channelId);
       } else {
         if (!_.has(commands, command)) sendMessage(channelId, `Command "${command}" not found!`);
         return _.get(commands, command)(channelId, args);
       }
     }

     return sendMessage(channelId, 'No valid command passed!');
   }

   /**
    * Join the given voice channel
    *
    * @param  {String} channelId Channel id
    *
    * @return {Promise}
    */
   async function joinVoiceChannel(channelId) {
     return new Promise((resolve, reject) => {
       if (_.get(voiceChannel, 'id') === channelId) return resolve();
       client.joinVoiceChannel(channelId, (err, ev) => {
         if (err) return reject(err);
         voiceChannel = _.find(client.channels, c => c.id === channelId);
         audioContext = undefined;
         return resolve(ev);
       });
     });
   }

  /**
   * Leave the given voice channel
   *
   * @param  {String} channelId Channel id
   *
   * @return {Promise}
   */
  async function leaveVoiceChannel(channelId) {
    const client = await init();

    return new Promise((resolve, reject) => {
      client.leaveVoiceChannel(channelId, (err, ev) => {
        if (err) return reject(err);
        voiceChannel = undefined;
        audioContext = undefined;
        return resolve(ev);
      });
    });
  }

  /**
   * Get the audio context for the given channel
   *
   * @param  {String} channelId Channel id
   *
   * @return {Promise}
   */
  async function getAudioContext(channelId) {
    const client = await init();

    return new Promise((resolve, reject) => {
      if (audioContext && _.get(voiceChannel, 'id') === channelId) return resolve(audioContext);

      client.getAudioContext(channelId, (err, stream) => {
        if (err) return reject(err);
        audioContext = stream;
        return resolve(stream);
      });
    });
  }

  /**
   * Get a channel by name
   *
   * @param  {String} name Channel name
   *
   * @return {Channel}
   */
  function getChannelByName(name = '') {
    return _.find(client.channels, (c => c.name.toUpperCase().endsWith(name.toUpperCase())));
  }

  /**
   *
   *
   * @return {[type]} [description]
   */
  function getChannels() {

  }

  /**
   * Post a message in the given channel
   *
   * @param  {String} channelId Channel id
   * @param  {String} message   Message
   *
   * @return {Promise}
   */
  async function sendMessage(to, message) {
    const client = await init();
    client.sendMessage({
        to,
        message
    });
  }

  function registerWidget(id, factory) {
    if (_.has(widgets, id)) throw new Error(`Widget with id ${id} already registered!`);
    widgets[id] = factory;
  }

  function unregisterWidget() {

  }

  /**
   * Run the bot
   *
   * @return {Promise}
   */
  async function run() {
    await init();

    logger.info('BOT: Initialize widgets');
    await(Promise.all(_.map(widgets, (widget) => widget.init())));

    logger.info('BOT: Register bot commands');
    client.on('message', function (user, userId, channelId, message, evt) {
      // I saw a schanutzebot in message... yeah i'm famous
      if (message.startsWith('schnautzebot ')) {
        // Shall i execute a commmand?
        const argString = message.replace('schnautzebot', '').trim();
        return executeCommand(channelId, argString);
      }

      if (message.startsWith('schnautzebot:')) {
        const widget = _.head(message.split(' ')).split(':')[1];
        if (!_.has(widgets, widget)) return sendMessage(channelId, `No widget with name ${widget} registered!`);

        const argString = message.replace(`schnautzebot:${widget}`, '').trim();
        return executeCommand(channelId, argString, _.get(widgets, widget));
      }
    });
  }

  return bot;
}

module.exports = Bot;
