const bot = require('./bot'),
      monk = require('monk'),
      dbUri = process.env.MONGO || 'mongodb://localhost:27017/notes',
      db = monk(dbUri),
      notes = db.get('notes'),
      cronNote = require('cron').CronJob,
      sendDataCurrency = require('./currency').sendDataCurrency,
      sendCustomDataCurrency = require('./currency').sendCustomDataCurrency;

/* Cron Hash */

const cronNoteHash = new Map();

function getNoteId(user, time, msg) {
  return `${user}${time.h}${time.m}${msg}`;
}

function stopNote(user, time, msg) {
  if (cronNoteHash.has(getNoteId(user, time, msg))) {
      cronNoteHash.get(getNoteId(user, time, msg)).stop();
  }
}

function setCronNote(user, time, msg, tz) {
  const noteTime = `00 ${time.m} ${time.h} * * *`;

  const note = new cronNote({
    cronTime: noteTime,
    onTick() {
      if (msg.match(/\/cc\s+([a-z]+)/)) {
        const match = msg.match(/\/cc\s+([a-z]+)/),
              unit = match[1].toUpperCase();

        sendDataCurrency(unit, user, 'latest');

        return;
      } else if (msg.match(/\/cc\s+([0-9]+)\s+([a-z]+)\s+to\s+([a-z]+)/)) {
        const match = msg.match(/\/cc\s+([0-9]+)\s+([a-z]+)\s+to\s+([a-z]+)/),
              unitNum = match[1],
              unit = match[2].toUpperCase(),
              unitCon = match[3].toUpperCase();

        sendCustomDataCurrency(unitNum, unit, unitCon, user, 'latest');

        return;
      }

      bot.sendMessage(user, msg);
    },
    start: true,
    timeZone: tz
  });

  cronNoteHash.set(getNoteId(user, time, msg), note);
}

/* Set note from database */

db.then(() => {
  notes.find({}).each((item) => {
    const user = item.name,
          tz = item.tz;

    if (item.notifications) {
      item.notifications.forEach((item) => {
        setCronNote(user, item[0], item[1], tz);
      });
    }
  }).then(() => {
    console.log('Set notes!');
  });
});

/* Set note */

bot.onText(/\/note +([0-9]+):([0-9]+)\s+-\s+(.+)/, (msg, match) => {
  const userId = msg.from.id,
        timeObj = { h: match[1], m: match[2] },
        noteMsg = match[3];

  notes.findOne({ name: userId }).then((user) => {
    if (user && user.timezone) {
      notes.update(
        { name: userId },
        { 
          $push: { notifications: [timeObj, noteMsg] }
        }
      ).then(() => {
        setCronNote(userId, timeObj, noteMsg, user.timezone);
        getNoteList(userId);
      });
    } else {
      bot.sendMessage(userId, 'Please use /tz to set the timezone');
    }
  });
});

/* Get note list */

function getNoteList(userId) {
  let noteList,
      noteNum = 0;
 
  notes.findOne({ name: userId }).then((user) => {
    if (user && user.notifications != 0) {
      noteList = user.notifications.map((note) => {
        return `${++noteNum}. ${note[0].h}:${note[0].m} - ${note[1]}`;
      });

      bot.sendMessage(userId, '<b>Your note list:</b>\n\n' + noteList.join('\n'), {
        parse_mode: 'HTML'
      });
    } else {
      bot.sendMessage(userId, 'List of notes is empty');
    }
  });
}

bot.onText(/\/note_ls/, (msg, match) => {
  getNoteList(msg.from.id);
});

/* Remove note */

bot.onText(/\/note_rm (.+)/, (msg, match) => {
  const userId = msg.from.id,
        noteNum = match[1] - 1;

  notes.findOne({ name: userId }).then((user) => {
    let noteDel = user.notifications[noteNum];

    if (noteDel) {
      notes.update(
        { name: userId }, 
        { 
          $pull: { notifications: noteDel }
        }
      ).then(() => {
        stopNote(userId, noteDel[0], noteDel[1]);
        getNoteList(userId)
      });
    }
  });
});

/* Time zone */

const cityTimezones = require('city-timezones');

bot.onText(/\/tz (.+)/, (msg, match) => {
  const userId = msg.from.id,
        tz = match[1].charAt(0).toUpperCase() + match[1].slice(1),
        checkZone = cityTimezones.lookupViaCity(tz);

  if (checkZone.length != 0) {
    notes.findOne({ name: userId }).then((user) => {
      if (user) {
        notes.update(
          { name: userId },
          { 
            $set: { timezone: checkZone[0].timezone }
          }
        ).then(() => {
          user.notifications.forEach((item) => {
            stopNote(userId, item[0], item[1]);
            setCronNote(userId, item[0], item[1], checkZone[0].timezone);
          });
        });
      } else {
        notes.insert(
          {
            name: userId,
            timezone: checkZone[0].timezone
          }
        );
      }
    });
  } else {
    bot.sendMessage(userId, 'Unknown city');
  }
});