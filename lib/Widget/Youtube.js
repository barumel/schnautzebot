const _ = require('lodash');
const logger = require('winston');
const { google } = require('googleapis');
const moment = require('moment');

function Widget(config, bot) {
  let client;

  const widget = {
    init,
    getDescription,
    executeCommand
  };

  const commands = {
    '--help': async function(discordChannelId) {
      await bot.sendMessage(discordChannelId, `
        Available Commands:
        **--help**: Show this message
        **--subscribe-channel**: Subscribe to a youtube channel
            Parameters:
            --id: Youtube channel id. Required!
            --target: Discord channel name (e.g. noobtalk). Required!
            --tags: Comma separated list of video tags (e.g. bf5,sims4). Optional
        **--list-channel-subscriptions**: List all channel subscriptions
      `);
    },
    '--subscribe-channel': function(discordChannelId, args) {
      const { id, target, tags = []} = args;
      if (_.isUndefined(id) || _.isUndefined(target)) return bot.sendMessage(discordChannelId, `
        You must provide the "--id" (Youtube channel id) and "--target" (Target channel name in dicord e.g. noobtalk) arguments!
      `);

      subscribeChannel(id, target, tags, discordChannelId);
    },
    '--list-channel-subscriptions': function(discordChannelId) {
      const subscriptions = config.get('youtube.subscriptions');
      let message = '**Current Channel subscriptions:**';
      subscriptions.forEach(s => {
        message = `${message}
          ------------------------------------------------------------------
          **${_.get(s, 'snippet.title')} (${_.get(s, 'channelId')})**
          ${_.get(s, 'snippet.description')}
          Tags: ${_.get(s, 'tags', []).join(',')}
          Target: ${_.get(s, 'target')}
          ------------------------------------------------------------------
        `;
      })

      bot.sendMessage(discordChannelId, message);
    }
  };

  async function init() {
    logger.info('YOUTUBE: Initialize youtube widget...');
    logger.info('YOUTUBE: Create youtube client');
    client = google.youtube({
      version: 'v3',
      auth: config.get('youtube.token')
    });

    // Check for subscriptions when widget starts
    checkChannelSubscriptions();

    // Check for channel subscriptions every hour
    setInterval(checkChannelSubscriptions, 900000);
  }

  function getDescription() {
    return `Add channel subscriptions or play music from youtube`;
  }

  async function executeCommand(command, args, channelId) {
    if (!_.has(commands, command)) {
      await bot.sendMessage(channelId, `Command "${command}" not found!`);
      command = '--help';
    }

    return await _.get(commands, command)(channelId, args);
  }

  /**
   * Add a subscription for the given youtube channel id
   *
   * @param  {String} channelId        Youtube channel id
   * @param  {String} targetName       Target discord channel name
   * @param  {Array}  tags             Array of video tags
   * @param  {String} discordChannelId Discord channel id (caller) for feedback
   *
   * @return void
   */
  async function subscribeChannel(channelId, targetName, tags, discordChannelId) {
    const target = _.get(bot.getChannelByName(targetName), 'id');
    if (_.isUndefined(target)) return bot.sendMessage(discordChannelId, `Discord (--target) channel with name "${targetName}" not found!`);

    const result = await client.channels.list({
      part: 'id,contentDetails,snippet',
      //id: 'UC9YTp5M6yYgSd6t0SeL2GQw',
      id: channelId
    });

    const channel = _.head(_.get(result, 'data.items', []));
    if (_.isUndefined(channel)) return bot.sendMessage(discordChannelId, `Youtube channel with id (--id) "${channelId}" not found!`);

    const snippet = _.get(channel, 'snippet');

    const subscription = {
      type: 'channel',
      channelId,
      target,
      tags,
      snippet
    };

    const subscriptions = config.get('youtube.subscriptions', []);
    subscriptions.push(subscription);

    config.set('youtube.subscriptions', subscriptions);

    bot.sendMessage(discordChannelId, `Youtube channel ${_.get(snippet, 'title')} (${channelId}) succesfully added!`);
  }

  async function unsubscribeChannel() {

  }

  async function checkChannelSubscriptions() {
    logger.info('YOUTUBE: Check channel subscriptions...');
    const subscriptions = config.get('youtube.subscriptions');
    const date = moment();
    const lastCheck = config.has('youtube.lastCheck')
      ? moment(config.get('youtube.lastCheck'))
      : moment().subtract(1, 'hour');

    for (const subscription of subscriptions) {
      const { channelId, target } = subscription;
      const result = await client.channels.list({
        part: 'id,contentDetails,snippet',
        id: channelId
      });

      const channel = _.head(_.get(result, 'data.items', []));
      const playlist = _.get(channel, 'contentDetails.relatedPlaylists.uploads');
      const videos = await client.playlistItems.list({
        part: 'id,contentDetails,snippet',
        playlistId: playlist
      });

      _.get(videos, 'data.items', []).forEach(video => {
        const videoDate = moment(_.get(video, 'contentDetails.videoPublishedAt'));
        const url = `https://www.youtube.com/watch?v=${_.get(video, 'contentDetails.videoId')}`;
        if (videoDate.isSameOrAfter(lastCheck)) {
          logger.info(`YOUTUBE: Found new video on channel ${_.get(s, 'snippet.title')} (${_.get(s, 'channelId')})`);
          bot.sendMessage(target, url);
        }
      });
    }

    config.set('youtube.lastCheck', date.format());
  }

  return widget;
}

module.exports = Widget;
