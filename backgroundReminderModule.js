﻿// this is loaded only in the background

var _remindersEnabled = true; // manual override

if (_remindersEnabled) {
  chrome.notifications.getPermissionLevel(function (level) {
    // ensure flag is off if user has disabled them
    if (level !== 'granted') {
      _remindersEnabled = false;
    }
  });
}


var ReminderModule = function () {

  var _ports = [];
  var _reminderPrefix = 'reminder_';
  var _specialDays = {};
  var _reminderInfoShown = null;
  var _remindersDefined = [];
  var _nowDi = null;
  var _nowNoon = null;
  var _nowSunTimes = null;

  function loadSamples() {
    _remindersDefined = [
      {
        trigger: 'load',
        num: 3, // negative is after
        units: 'seconds',
        delta: 1, // 1==after, -1==before (default)
        api: 'chrome',
        body: 'Yeah!\nReminders are active...'
      },
      {
        trigger: 'sunset',
        num: 10,
        units: 'minutes',
        body: 'Sunset in 10 minutes'
      },
      {
        trigger: 'noon',
        num: 1,
        units: 'hours',
        body: 'Reminder'
      },
      {
        trigger: 'midnight',
        num: 10,
        units: 'minutes',
        body: 'Midnight in 10 minutes'
      },
      {
        trigger: 'feast',
        num: 2,
        alertTime: '23:50',
        //alertAtHr: 23,
        //alertAtMin: 50,
        body: 'Feast soon!'
      },
      {
        trigger: 'holyday',
        num: 2,
        alertTime: '22:35',
        //alertAtHr: 22,
        //alertAtMin: 35,
        body: 'Holy Day soon!'
      },
      {
        trigger: 'bday',
        day: 11,
        alertTime: '06:00',
        //alertAtHr: 6,
        //alertAtMin: 0,
        body: 'Badi Day'
      }
    ];
    storeReminders();
  }

  var adjustTime = function (d, reminder) {
    var ms = 0;
    reminder.delta = reminder.delta || -1;
    switch (reminder.units) {
      case 'seconds':
        ms = reminder.num * 1000;
        break;

      case 'minutes':
        ms = reminder.num * 1000 * 60;
        break;

      case 'hours':
        ms = reminder.num * 1000 * 60 * 60;
        break;

      case 'days':
        ms = reminder.num * 1000 * 60 * 60 * 24;
        break;
    }

    //log(d);
    //log('{0} {1} {2}'.filledWith(reminder.delta == -1 ? 'minus' : 'plus', reminder.num, reminder.units));
    d.setTime(d.getTime() + ms * (reminder.delta));
    //log(d);
  }

  var storeAlarmReminder = function (reminder) {
    // store, and give back key to get it later
    for (var nextKey = 0; ; nextKey++) {
      if (getStorage(_reminderPrefix + nextKey, '') == '') {
        // empty slot
        setStorage(_reminderPrefix + nextKey, reminder);
        return nextKey;
      }
    }
  }

  var saveAllReminders = function (newSetOfReminders, fnAfter) {
    _remindersDefined = newSetOfReminders;
    storeReminders(fnAfter);
  }

  var addTimeAlarm = function (eventTime, reminderTemplate) {
    var now = new Date();
    var alarmInfo = shallowCloneOf(reminderTemplate);
    alarmInfo.eventTime = eventTime.getTime();
    var triggerTime = new Date(alarmInfo.eventTime);
    adjustTime(triggerTime, alarmInfo);

    // only activate if it will go off between now and next midnight
    if (now.toDateString() == triggerTime.toDateString() && triggerTime > now) {
      alarmInfo.triggerTime = triggerTime.getTime();
      createRawAlarm(alarmInfo);
    }
  }

  var createRawAlarm = function (alarmInfo) {
    log('CREATE ALARM ' + alarmInfo.trigger);
    chrome.alarms.create(_reminderPrefix + storeAlarmReminder(alarmInfo), { when: alarmInfo.triggerTime });
  }

  var addAlarmFor = {
    'load': function (reminder) {
      var eventTime = new Date();
      addTimeAlarm(eventTime, reminder);
    },
    'sunset': function (reminder) {
      var eventTime = _nowSunTimes.sunset;
      addTimeAlarm(eventTime, reminder);
    },
    'sunrise': function (reminder) {
      var eventTime = _nowSunTimes.sunrise;
      addTimeAlarm(eventTime, reminder);
    },
    'noon': function (reminder) {
      var eventTime = _nowNoon;
      addTimeAlarm(eventTime, reminder);
    },
    'midnight': function (reminder) {
      var eventTime = new Date();
      eventTime.setHours(reminder.delta == -1 ? 24 : 0, 0, 0, 0);
      addTimeAlarm(eventTime, reminder);
    },
    'feast': function (reminder) {
      addEventAlarm(reminder);
    },
    'holyday': function (reminder) {
      addEventAlarm(reminder);
    },
    'bday': function (reminder) {
      addBDayAlarm(reminder);
    }
  };


  function addBDayAlarm(reminder) {
    var alertTime = new Date();
    alertTime.setHours(reminder.alertTime.substr(0, 2), reminder.alertTime.substr(3, 2), 0, 0);

    if (alertTime < new Date()) {
      // already past for today
      alertTime.setHours(_nowDi.currentTime.getHours(), _nowDi.currentTime.getMinutes(), _nowDi.currentTime.getSeconds() + 5, 0);
    }
    if (_nowDi.bDay != reminder.num) {
      return;
    }
    
    var alarmInfo = shallowCloneOf(reminder);
    alarmInfo.eventTime = _nowDi.frag1SunTimes.sunset.getTime();
    alarmInfo.triggerTime = alertTime.getTime();

    if (alertTime.getTime() > alarmInfo.eventTime) {
      alarmInfo.delta = 1;
    }

    alarmInfo.body = _nowDi.nearestSunset;
    createRawAlarm(alarmInfo);
  }

  function shallowCloneOf(obj) {
    var clone = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        clone[key] = obj[key];
      }
    }
    return clone;
  }

  function addEventAlarm(reminder) {
    var alertTime = new Date();
    //alertTime.setHours(reminder.alertAtHr, reminder.alertAtMin, 0, 0);
    alertTime.setHours(reminder.alertTime.substr(0, 2), reminder.alertTime.substr(3, 2), 0, 0);

    if (alertTime < new Date()) {
      // already past for today, show now!
      alertTime.setHours(_nowDi.currentTime.getHours(), _nowDi.currentTime.getMinutes(), _nowDi.currentTime.getSeconds() + 5, 0);
    }

    // check for an event this number of days in the future
    var testTime = new Date(alertTime.getTime());
    testTime.setDate(testTime.getDate() + +reminder.num);

    var testDayDi = getDateInfo(new Date(testTime.getFullYear(), testTime.getMonth(), 1 + testTime.getDate()));

    if (!_specialDays[testDayDi.bYear]) {
      _specialDays[testDayDi.bYear] = holyDays.prepareDateInfos(testDayDi.bYear);
    }

    var typeWanted = reminder.trigger == 'feast' ? 'M' : 'H';

    var holyDayInfo = $.grep(_specialDays[testDayDi.bYear], function (el, i) {
      return el.Type.substring(0, 1) == typeWanted && el.BDateCode == testDayDi.bDateCode;
    });

    if (holyDayInfo.length == 0) {
      return;
    }

    // got one!
    $.each(holyDayInfo, function (i, hd) {
      var alarmInfo = shallowCloneOf(reminder);
      alarmInfo.eventTime = testDayDi.frag1SunTimes.sunset.getTime();
      alarmInfo.triggerTime = alertTime.getTime();

      alarmInfo.body = typeWanted == 'H' ? getMessage(holyDayInfo[0].NameEn) : getMessage('FeastOf').filledWith(testDayDi.bMonthMeaning);
      createRawAlarm(alarmInfo);
    });
  }


  function triggerAlarmNow(alarmName) {
    if (!alarmName.startsWith(_reminderPrefix)) {
      log('unexpected reminder alarm: ' + alarmName);
      return;
    }

    var alarmInfo = getStorage(alarmName);
    if (!alarmInfo) {
      log('no info for ' + alarmName);
      return;
    }

    if (alarmInfo.eventTime < new Date().getTime()) {
      log('reminder requested, but past time.', alarmInfo);
      return;
    }

    triggerAlarmInternal(alarmInfo, alarmName);

    localStorage.removeItem(alarmName);
  }

  function showTestAlarm(alarmInfo) {
    triggerAlarmInternal(alarmInfo, 'test');
  }

  function triggerAlarmInternal(alarmInfo, alarmName) {
    var info = {
      when: new Date().showTime()
    }

    var iconUrl = getIcon(alarmInfo);
    var body = (alarmInfo.title || '')
        + (alarmInfo.title && alarmInfo.body ? '\n' : '')
        + (alarmInfo.body || '');
    var tagLine = getMessage('reminderTagline').filledWith(info);

    var triggerDisplayName = getMessage('reminderTitleFormat', {
      event: getMessage('reminderTrigger_' + alarmInfo.trigger),
      time: alarmInfo.eventTime ? new Date(alarmInfo.eventTime).showTime() : '___'
    });
    var api = alarmInfo.api || 'html';
    switch (api) {
      case 'chrome':
        // closes automatically after a few seconds
        chrome.notifications.create(null, {
          type: 'basic',
          iconUrl: iconUrl,
          title: triggerDisplayName,
          message: body,
          contextMessage: tagLine
        }, function (id) {
          //log('chrome notification ' + id);
        });
        break;

      case 'html':
        var n = new Notification(triggerDisplayName, {
          icon: iconUrl,
          body: body
            + '\n' + tagLine,
          lang: _languageCode,
          dir: _languageDir,
          tag: 'html' + alarmName
        });
        break;
    }

    try {
      prepareAnalytics();

      tracker.sendEvent('showReminder', alarmInfo.trigger, alarmInfo.delta * alarmInfo.num + ' ' + alarmInfo.units + ' ' + api);
    } catch (e) {
      log(e);
    }

    if (alarmInfo.action) {
      doAdditionalActions(alarmInfo, triggerDisplayName, body, tagLine)
    }
  }

  function doAdditionalActions(alarmInfo, title, body, tag) {
    switch (alarmInfo.action) {
      case 'ifttt':
        var url = 'https://maker.ifttt.com/trigger/{iftttEvent}/with/key/{iftttId}'.filledWith(alarmInfo);
        var content = {
          'value1': title,
          'value2': body,
          'value3': tag
        };
        try {
          $.ajax({
            url: url,
            data: content,
            success: function (data) {
              chrome.notifications.create(null, {
                type: 'basic',
                iconUrl: 'badi19a-128.png',
                title: alarmInfo.actionDisplay,
                message: data,
              });
            },
            error: function (request, error) {
              alert("Request: " + JSON.stringify(request));
            }
          });

        } catch (e) {
          log(e);
        }

        break;
    }
  }

  function getIcon(reminder) {
    var icon = 'badi19a-128.png';
    switch (reminder.trigger) {
      case 'sunrise':
      case 'sunset':
      case 'noon':
        icon = 'sun32.jpg';
        break;
      case 'feast':
        icon = '9point32.png';
        break;
      case 'holyday':
        icon = 'star32.jpg';
        break;
      case 'bday':
        icon = '9point32.png';
        break;
      case 'load':
      default:
        // use default
        break;
    }
    //log('icon for {0} = {1}'.filledWith(reminder.trigger, icon));
    return icon;
  }

  function activateForToday(initialLoad) {
    // clear, then set again
    clearReminderAlarms(function () {
      activateAlarms(initialLoad);
    });
  }

  function activateAlarms(initialLoad) {
    if (!_remindersEnabled) return;

    var now = new Date();
    _nowDi = getDateInfo(now);

    _nowNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

    _nowSunTimes = sunCalculator.getTimes(_nowNoon, _locationLat, _locationLong);

    log('checking ' + _remindersDefined.length + ' reminders at ' + new Date());

    for (var i = 0; i < _remindersDefined.length; i++) {
      var reminder = _remindersDefined[i];
      if (reminder.trigger == 'load' && !initialLoad) {
        continue;
      }
      addAlarmFor[reminder.trigger](reminder);
    }

    //storeReminders();
    broadcast({ code: 'alarmsUpdated' });
  }

  function clearReminderAlarms(fnAfter) {
    chrome.alarms.getAll(function (alarms) {
      for (var i = 0; i < alarms.length; i++) {
        var alarm = alarms[i];
        var name = alarm.name;
        if (name.startsWith(_reminderPrefix)) {
          log('removed {0} {1}'.filledWith(alarm.name, new Date(alarm.scheduledTime)));
          chrome.alarms.clear(name);
          localStorage.removeItem(name);
        }
      }
      for (var key in localStorage) {
        if (key.startsWith(_reminderPrefix)) {
          localStorage.removeItem(key);
        }
      }
      if (fnAfter) {
        fnAfter();
      }
    });
  }

  function dumpAlarms() {
    chrome.alarms.getAll(function (alarms) {
      for (var i = 0; i < alarms.length; i++) {
        var alarm = alarms[i];
        log('{0} {1}'.filledWith(alarm.name, new Date(alarm.scheduledTime)));
        log(alarm);
      }
    });
  }


  function storeReminders(fnAfter) {
    chrome.storage.local.set({
      reminders: _remindersDefined
    }, function () {
      log('stored reminders with local');
      if (chrome.runtime.lastError) {
        log(chrome.runtime.lastError);
      }
      if (fnAfter) {
        fnAfter();
      }
    });
    chrome.storage.sync.set({
      reminders: _remindersDefined
    }, function () {
      log('stored reminders with sync');
      if (chrome.runtime.lastError) {
        log(chrome.runtime.lastError);
      }
      if (fnAfter) {
        fnAfter();
      }
    });
  }

  function loadReminders(fnAfter) {
    chrome.storage.sync.get({
      reminders: []
    }, function (items) {
      if (chrome.runtime.lastError) {
        log(chrome.runtime.lastError);
      }

      if (items.reminders) {
        log('reminders loaded from sync: ' + items.reminders.length);
        _remindersDefined = items.reminders;
      }

      if (_remindersDefined.length != 0) {
        activateForToday(true);

        if (fnAfter) {
          fnAfter();
        }
      } else {
        chrome.storage.local.get({
          reminders: []
        }, function (items) {
          if (chrome.runtime.lastError) {
            log(chrome.runtime.lastError);
          }

          if (items.reminders) {
            log('reminders loaded from local: ' + items.reminders.length);
            _remindersDefined = items.reminders;
          }

          activateForToday(true);

          if (fnAfter) {
            fnAfter();
          }

          //if (!items.reminders || !items.reminders.length) {
          //  log('loading samples');
          //  loadSamples();
          //}

        });
      }
    });
  }

  function connectToPort() {
    log('listening for new ports');
    chrome.runtime.onConnect.addListener(function (port) {
      if (port.name != "reminderModule") {
        return; // not for us
      }

      _ports.push(port);
      log('ports: ' + _ports.length);

      // each popup will have its own port for us to respond to
      log('listening to port', port.name, 'from', port.sender.id);

      port.onDisconnect.addListener(function (port) {
        for (var i = 0; i < _ports.length; i++) {
          var knownPort = _ports[i];
          if (knownPort === port) {
            log('removed port');
            _ports.splice(i, 1);
          }
        }
      });

      port.onMessage.addListener(function (msg) {
        log('received: ', msg);

        switch (msg.code) {

          case 'getReminders':
            // send back the list
            msg.reminders = _remindersDefined;
            port.postMessage(msg);
            break;

          case 'activateForToday':
            activateForToday();
            break;

          case 'saveAllReminders':
            saveAllReminders(msg.reminders);
            // send back (to all ports)
            broadcast(msg);

            activateForToday();
            break;

          case 'showTestAlarm':
            showTestAlarm(msg.reminder);
            break;
        }

      });
    });
  }

  function broadcast(msg) {
    // send to all ports
    for (var i = 0; i < _ports.length; i++) {
      _ports[i].postMessage(msg);
    }
  }

  loadReminders();
  connectToPort();
  broadcast({ code: 'remindersEnabled' });

  return {
    activateForToday: activateForToday,
    triggerAlarmNow: triggerAlarmNow,
    loadSamples: loadSamples,
    dumpAlarms: dumpAlarms,
    clearReminderAlarms: clearReminderAlarms,
    saveAllReminders: saveAllReminders,
    getReminders: function () {
      return _remindersDefined;
    },
    _specialDays: _specialDays // testing
  }
}