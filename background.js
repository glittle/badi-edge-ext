/* Code by Glen Little */

/*
 * Notes...
 * Firefox does not support canvas or geolocation in the background. Must open the tab to work.
 * 
 */


var _isBackgroundPage = true;
var _backgroundReminderEngine = {};
var popupUrl = browser.extension.getURL('popup.html');

var BackgroundModule = function() {

    var alarmHandler = function(alarm) {
        if (alarm.name.startsWith('refresh')) {
            console.log('ALARM: ' + alarm.name);
            refreshDateInfoAndShow();
            _backgroundReminderEngine.setAlarmsForRestOfToday();
        } else if (alarm.name.startsWith('alarm_')) {
            _backgroundReminderEngine.triggerAlarmNow(alarm.name);
        }
    };

    function installed(info) {
        if (info.reason == 'update') {
            setTimeout(function() {
                var newVersion = browser.runtime.getManifest().version;
                var oldVersion = localStorage.updateVersion;
                if (newVersion != oldVersion) {
                    console.log(oldVersion + ' --> ' + newVersion);
                    localStorage.updateVersion = newVersion;
                    browser.tabs.create({
                        url: getMessage(browserHostType + '_History') + '?{0}:{1}'.filledWith(
                            browser.runtime.getManifest().version,
                            _languageCode)
                    });

                    setStorage('firstPopup', true);

                    try {
                        tracker.sendEvent('updated', getVersionInfo());
                    } catch (e) {
                        console.log(e);
                    }
                } else {
                    console.log(newVersion);
                }
            }, 1000);
        } else {
            console.log(info);
        }
    }

    //  function messageHandler(request, sender, sendResponse) {
    //    //log(request, sender, sendResponse);
    //    console.log('message received: ' + request.code);
    //  }

    function showErrors() {
        var msg = browser.runtime.lastError;
        if (msg) {
            console.log(msg);
        }
    }

    function makeTab() {
        browser.tabs.create({ url: popupUrl }, function(newTab) {
            setStorage('tabId', newTab.id);
        });
    };

    function prepare() {
        startGettingLocation();

        if (_notificationsEnabled) {
            _backgroundReminderEngine = new BackgroundReminderEngine();
        }

        if (browserHostType === browser.Chrome) {
            browser.alarms.clearAll();
            browser.alarms.onAlarm.addListener(alarmHandler);
            browser.runtime.onInstalled.addListener(installed);
        }

        if (browserHostType === browser.Firefox) {
            browser.browserAction.onClicked.addListener(function() {
                var oldTabId = +getStorage('tabId', 0);
                if (oldTabId) {
                    browser.tabs.update(oldTabId, {
                        active: true
                    }, function(updatedTab) {
                        if (!updatedTab) {
                            makeTab();
                        }
                        if (browser.runtime.lastError) {
                            console.log(browser.runtime.lastError.message);
                        }
                    });
                } else {
                    makeTab();
                }

            });
        }

        browser.contextMenus.create({
            'id': 'openInTab',
            'title': getMessage('browserMenuOpen'),
            'contexts': ['browser_action']
        }, showErrors);
        //browser.contextMenus.create({
        //  'id': 'paste',
        //  'title': 'Insert Badíʿ Date',
        //  'contexts': ['editable']
        //}, showErrors);

        browser.contextMenus.onClicked.addListener(function(info, tab) {
            switch (info.menuItemId) {
                //case 'paste':
                //  console.log(info, tab);
                //  browser.tabs.executeScript(tab.id, {code: 'document.targetElement.value = "help"'}, showErrors);
                //  break;

                case 'openInTab':
                    var afterUpdate = function(updatedTab) {
                        if (!updatedTab) {
                            makeTab();
                        }
                        if (browser.runtime.lastError) {
                            console.log(browser.runtime.lastError.message);
                        }
                    };

                    switch (browserHostType) {
                        case browser.Chrome:
                            browser.tabs.query({ url: popupUrl }, function(foundTabs) {
                                switch (foundTabs.length) {
                                    case 1:
                                        // resuse
                                        browser.tabs.update(foundTabs[0].id, {
                                            active: true
                                        }, afterUpdate);
                                        break;

                                    case 0:
                                        makeTab();
                                        break;

                                    default:
                                        // bug in March 2016 - all tabs returned!

                                        var oldTabId = +getStorage('tabId', 0);
                                        if (oldTabId) {
                                            browser.tabs.update(oldTabId, {
                                                active: true
                                            }, afterUpdate);
                                        } else {
                                            makeTab();
                                        }
                                        break;
                                }

                                if (tracker) {
                                    // not working?...
                                    tracker.sendEvent('openInTabContextMenu');
                                }
                            });

                            break;

                        default:
                            makeTab();

                            if (tracker) {
                                // not working?...
                                tracker.sendEvent('openInTabContextMenu');
                            }
                            break;
                    }

                    break;
            }
        });

        console.log('prepared background');

        if (browserHostType === browser.Firefox) {
            makeTab();
        }
    }

    return {
        prepare: prepare,
        makeTab: makeTab
    };
}

var _backgroundModule = new BackgroundModule();

$(function() {
    _backgroundModule.prepare();
});