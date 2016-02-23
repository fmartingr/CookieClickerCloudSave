/*
 * CookieClickerSync
 * @author Felipe Martin <me@fmartingr.com> @fmartingr
 * 2016
 */

// Add extend function to Object so we can merge associative arrays
Object.extend = function(destination, source) {
  for (var property in source) {
    if (source.hasOwnProperty(property)) {
      destination[property] = source[property];
    }
  }
  return destination;
};

/*
 * CCCloud main object
 */
var CCCloud = {};

// Initial configuration variables
CCCloud.Config = {
  varName: {
    localStorageBackupKey: 'CCCloud.backupSaveString',
    localStorageKey: 'CCCloud.lastSave',
    remoteStorageKey: 'savegame'
  },
  interval: 30 // Default interval to autosync the game
}

/*
 * State machine
 * Useful to store status for the various components of the addon.
 */
CCCloud.State = {
  lastSave: { // Empty last save state to initialize states
    time: 0,
    str: ''
  }
};

/*
 * Providers
 */
CCCloud.Providers = {};

// Firebase
CCCloud.Providers.Firebase = {};
CCCloud.Providers.Firebase.init = function() {
  // Init loads the official firebase javascript library
  CCCloud.State._providerLoadFinished = false;
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('src', 'https://cdn.firebase.com/js/client/2.4.0/firebase.js');
  script.onload = function() {
    CCCloud.State._providerLoadFinished = true;
    CCCloud.State._firebase = new Firebase(CCCloud.Config.providerConf.url);
  };
  document.head.appendChild(script);
};
CCCloud.Providers.Firebase._setKey = function(key, value, callback) {
  CCCloud.State._firebase.child(key).set(value, callback);
};
CCCloud.Providers.Firebase._getKey = function(key, callback) {
  CCCloud.State._firebase.child(key).once('value', function(result) {
    callback(result.val());
  });
};
CCCloud.Providers.Firebase.save = function(data, callback) {
  this._setKey(CCCloud.Config.varName.remoteStorageKey, data, function(error) {
    // TODO handle errors
    if (!error && callback) callback(true);
  })
};
CCCloud.Providers.Firebase.load = function(callback) {
  this._getKey(CCCloud.Config.varName.remoteStorageKey, function(result) {
    // TODO handle errors
    callback(result);
  });
};
CCCloud.Providers.Firebase.testConfig = function(callback) {
  var $provider = this;
  $provider._setKey('_check', "y", function(error) {
    $provider._getKey('_check', function(result) {
      if (result === "y") callback(true);
      else callback(false);
    })
  });
};

/*
 * Notifications
 */
CCCloud.Notifications = {};
CCCloud.Notifications.notify = function(content) {
  Game.Notify('CookieClicker Sync', content, null, false);
};
CCCloud.Notifications.quickNotify = function(content) {
  Game.Notify(content, '', null, true);
};

/*
 * Interval
 * Handles the interval that syncs the save with the provider
 */
CCCloud.Interval = {};
CCCloud.Interval.start = function() {
  if (CCCloud.State._interval) CCCloud.State.stop();
  CCCloud.State._interval = setInterval(function() { CCCloud.Interval.run() }, CCCloud.Config.interval*1000)
};

CCCloud.Interval.stop = function() {
  if (CCCloud.State._interval) clearInterval(CCCloud.State._interval);
};

CCCloud.Interval.run = function() {
  CCCloud.Save.sync();
  CCCloud.Notifications.quickNotify('Save game synced');
}

/*
 * Saves
 */
CCCloud.Save = {};
CCCloud.Save.getForStorage = function(game) {
  return { game: game, time: CCCloud.Utils.getTime() }
}
CCCloud.Save.load = function(save) {
  Game.LoadSave(save.game);
  this._setLastSave(save);
};
CCCloud.Save._setLastSave = function(save) {
  localStorage.setItem(CCCloud.Config.varName.localStorageKey, JSON.stringify(save));
}
CCCloud.Save.get = function() {
  return Game.WriteSave(1);
};
CCCloud.Save.sync = function() {
  var save = this.getForStorage(this.get());
  CCCloud.$provider.save(save);
  this._setLastSave(save);
};

/*
 * Utils
 */
CCCloud.Utils = {};
CCCloud.Utils.getTime = function() {
  if (!Date.now) {
    // Fix for old browsers. Probably not needed, but...
    return new Date().getTime();
  } else {
    return Date.now();
  }
};

/*
 * Addon logging helpers
 */
CCCloud.Log = {}
CCCloud.Log._log = function(level, message) {
  if (window.console) console[level](message);
}
CCCloud.Log.info = function(message) {
  this._log('info', message);
}
CCCloud.Log.error = function(message) {
  this._log('error', message);
}
CCCloud.Log.warning = function(message) {
  this._log('warning', message);
}

/*
 * Startup phases
 */
CCCloud.init = function() {
  // Load user configuration
  Object.extend(this.Config, Game.CCCloudSaveConfig);

  // Load provider if configured and present
  if (!this.Config.provider) {
    this.Notifications.notify('Failed to start: Provider not specified.');
    return false;
  }

  if (!(this.Config.provider in this.Providers)) {
    CCCloud.Notifications.notify('Failed to start: Provider ' + this.Config.provider + ' does not exist.');
    return false;
  }

  this.$provider = this.Providers[this.Config.provider];
  this.$provider.init();

  this.State._providerLoadInterval = setInterval(function() {
                                       // TODO Check iterations and break at some point.
                                         if (CCCloud.State._providerLoadFinished) {
                                           clearInterval(CCCloud.State._providerLoadInterval);
                                           CCCloud.State._providerLoadInterval = null;
                                           CCCloud.checkStuff();
                                         }
                                       }, 500);
  return true;
};

CCCloud.checkStuff = function() {
  // Check provider
  this.Providers[this.Config.provider].testConfig(function(success) {
    if (success) {
      CCCloud.start();
      return true;
    } else {
      CCCloud.Notifications.notify('Failed to start: Check your provider configuration.');
      return false;
    }
  });
};

CCCloud.start = function() {
  // Load current epoch time
  this.State.epoch = this.Utils.getTime();

  // Load last synced save (if present)
  var lastSave = localStorage.getItem(this.Config.varName.localStorageKey);
  if (lastSave) {
    this.State.lastSynced = JSON.parse(lastSave);
  }

  // Get provider synced save
  this.$provider.load(function(syncedSave) {
    if (syncedSave && CCCloud.State.lastSynced) {
      // If both local and cloud are available, the newer is used.
      if (syncedSave.time > CCCloud.State.lastSynced.time) {
        CCCloud.Log.info('Cloud file is newer than last local synced save.');
        CCCloud.Save.load(syncedSave);
      } else {
        CCCloud.Log.info('Last local synced save is newer than cloud save.');
        CCCloud.$provider.save(CCCloud.State.lastSynced);
      }
    } else if (syncedSave && !CCCloud.State.lastSynced) {
      // If not local save is present but a cloud is
      CCCloud.Log.info('Last local save not present. Overwriting with cloud save.');
      // Backup current game, just in case!
      localStorage.setItem(CCCloud.Config.varName.localStorageBackupKey, CCCloud.Save.get());
      CCCloud.Save.load(syncedSave);
    } else if (!syncedSave && CCCloud.State.lastSynced) {
      // If not cloud save is present but local is
      // TODO is this clause really needed?
      CCCloud.Log.info('Cloud save not present, using last local synced save.');
      CCCloud.$provider.save(CCCloud.Save.getForStorage(CCCloud.State.lastSynced.game));
    } else {
      // If there's no cloud or local save present
      CCCloud.Log.info('Cloud/Last local synced save not present. Using last game status.');
      // Backup current game, just in case!
      localStorage.setItem(CCCloud.Config.varName.localStorageBackupKey, CCCloud.Save.get());
      CCCloud.Save.sync();
    }
  })

  // Autosync every Config.timer seconds.
  CCCloud.Interval.start();

  // Give the player the 'third party' achievement
  Game.Win('Third-party');

  return true; // Loaded succesfully.
};

// Init mod
CCCloud.init()
