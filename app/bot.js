/* Telegram */

const BotApi = require('node-telegram-bot-api');

let token;
let bot;

if (process.env.NODE_ENV === 'production') {
  token = process.env.BOT_TOKEN;

  bot = new BotApi(token);
  bot.setWebHook(process.env.URL + bot.token);
} else {
  require('dotenv').config();

  token = process.env.BOT_TOKEN_LOCAL;

  bot = new BotApi(token, { polling: true });
  bot.setWebHook();
}

module.exports = bot;

/* Time */

const moment = require('moment-timezone');
const cityTimezones = require('city-timezones');

bot.onText(/\/time\s+(.+[^\s])/i, (msg, match) => {
  let time;
  const checkZone = cityTimezones.lookupViaCity(match[1]);

  if (moment.tz.zone(match[1])) {
    time = moment().tz(match[1]).format('MMMM Do YYYY, h:mm:ss a');
  } else if (checkZone.length !== 0) {
    time = moment().tz(checkZone[0].timezone).format('MMMM Do YYYY, h:mm:ss a');
  } else {
    time = 'Unknown city';
  }

  bot.sendMessage(msg.from.id, time);
});

/* Random */

const Chance = require('chance');

const chance = new Chance();

bot.onText(/(\/random)$/i, (msg) => {
  bot.sendMessage(msg.from.id, chance.integer({ min: 0 }));
});

bot.onText(/\/random\s+([\d]+)-([\d]+)/i, (msg, match) => {
  try {
    chance.integer({ min: +match[1], max: +match[2] });
    bot.sendMessage(msg.from.id, chance.integer({ min: +match[1], max: +match[2] }));
  } catch (e) {
    bot.sendMessage(msg.from.id, e.message.replace('Chance: ', ''));
  }
});

/* Modules */

const inlineExcept = [];

module.exports.inlineExcept = inlineExcept;

require('./math');
require('./currency');
require('./crypto');
require('./note');
require('./charts');
require('./messages');
