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

// Addon main object
var CCSync = {};

// Init config
CCSync.Config = {
  varName: {
    localStorageKey: 'CCSync.lastSave',
    remoteStorageKey: 'savegame'
  },
  interval: 30 // Default interval to autosync the game
}

// Internal mod state
CCSync.State = {
  lastSave: { // Empty last save state to initialize states
    time: 0,
    str: ''
  }
};

// Init providers
CCSync.Providers = {};
CCSync.Providers.Firebase = {};
CCSync.Providers.Firebase.init = function() {
  CCSync.State._providerLoadFinished = false;
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('src', 'https://cdn.firebase.com/js/client/2.4.0/firebase.js');
  script.onload = function() {
    CCSync.State._providerLoadFinished = true;
    CCSync.State._firebase = new Firebase(CCSync.Config.providerConf.url);
  };
  document.head.appendChild(script);
};
CCSync.Providers.Firebase._setKey = function(key, value, callback) {
  CCSync.State._firebase.child(key).set(value, callback);
};
CCSync.Providers.Firebase._getKey = function(key, callback) {
  CCSync.State._firebase.child(key).once('value', function(result) {
    callback(result.val());
  });
};
CCSync.Providers.Firebase.save = function(data, callback) {
  this._setKey(CCSync.Config.varName.remoteStorageKey, data, function(error) {
    // TODO handle errors
    if (!error && callback) callback(true);
  })
};
CCSync.Providers.Firebase.load = function(callback) {
  this._getKey(CCSync.Config.varName.remoteStorageKey, function(result) {
    // TODO handle errors
    callback(result);
  });
};
CCSync.Providers.Firebase.testConfig = function(callback) {
  var $provider = this;
  $provider._setKey('_check', "y", function(error) {
    $provider._getKey('_check', function(result) {
      if (result === "y") callback(true);
      else callback(false);
    })
  });
};

// Notifications
CCSync.Notifications = {};
CCSync.Notifications.notify = function(content) {
  Game.Notify('CookieClicker Sync', content, null, false);
};
CCSync.Notifications.quickNotify = function(content) {
  Game.Notify(content, '', null, true);
};

// Interval
CCSync.Interval = {};
CCSync.Interval.start = function() {
  if (CCSync.State._interval) CCSync.State.stop();
  setInterval(function() { CCSync.Interval.run() }, CCSync.Config.interval*1000)
};

CCSync.Interval.stop = function() {
  if (CCSync.State._interval) clearInterval(CCSync.State._interval);
};

CCSync.Interval.run = function() {
  CCSync.Save.sync();
  CCSync.Notifications.quickNotify('Save game synced');
}

// Game save
CCSync.Save = {};
CCSync.Save.getForStorage = function(game) {
  return { game: game, time: CCSync.Utils.getTime() }
}
CCSync.Save.load = function(save) {
  Game.LoadSave(save.game);
  this._setLastSave(save);
};
CCSync.Save._setLastSave = function(save) {
  localStorage.setItem(CCSync.Config.varName.localStorageKey, JSON.stringify(save));
}
CCSync.Save.get = function() {
  return Game.WriteSave(1);
};
CCSync.Save.sync = function() {
  var save = this.getForStorage(this.get());
  console.log(save)
  CCSync.$provider.save(save);
  this._setLastSave(save);
};

// Utils
CCSync.Utils = {};
CCSync.Utils.getTime = function() {
  if (!Date.now) {
    // Fix for old browsers. Probably not needed, but...
    return new Date().getTime();
  } else {
    return Date.now();
  }
};

CCSync.init = function() {
  // Load user configuration
  Object.extend(this.Config, Game.CCSyncConfig);

  // Load provider if configured and present
  if (!this.Config.provider) {
    this.Notifications.notify('Failed to start: Provider not specified.');
    return false;
  }

  if (!(this.Config.provider in this.Providers)) {
    CCSync.Notifications.notify('Failed to start: Provider ' + this.Config.provider + ' does not exist.');
    return false;
  }

  this.$provider = this.Providers[this.Config.provider];
  this.$provider.init();

  this.State._providerLoadInterval = setInterval(function() {
                                       // TODO Check iterations and break at some point.
                                         if (CCSync.State._providerLoadFinished) {
                                           clearInterval(CCSync.State._providerLoadInterval);
                                           CCSync.State._providerLoadInterval = null;
                                           CCSync.checkStuff();
                                         }
                                       }, 500);
  return true;
};

CCSync.checkStuff = function() {
  // Check provider
  this.Providers[this.Config.provider].testConfig(function(success) {
    if (success) {
      CCSync.start();
      return true;
    } else {
      CCSync.Notifications.notify('Failed to start: Check your provider configuration.');
      return false;
    }
  });
};

CCSync.start = function() {
  // Load current epoch time
  this.State.epoch = this.Utils.getTime();

  // Load last synced save (if present)
  var lastSave = localStorage.getItem(this.Config.varName.localStorageKey);
  if (lastSave) {
    this.State.lastSynced = JSON.parse(lastSave);
  }

  // Get provider synced save
  this.$provider.load(function(syncedSave) {
    if (syncedSave && CCSync.State.lastSynced) {
      if (syncedSave.time > CCSync.State.lastSynced.time) {
        console.log('Synced is newer');
        CCSync.Save.load(syncedSave);
      } else {
        console.log('Local is newer');
        CCSync.$provider.save(CCSync.State.lastSynced);
      }
    } else if (syncedSave && !CCSync.State.lastSynced) {
      console.log('Local not present, using synced');
      CCSync.Save.load(syncedSave);
    } else if (!syncedSave && CCSync.State.lastSynced) {
      console.log('Synced not present, using local')
      CCSync.$provider.save(CCSync.Save.getForStorage(CCSync.State.lastSynced.game));
    } else {
      console.log('Synced nor local present')
      CCSync.Save.sync();
    }
  })

  // Autosync every Config.timer seconds.
  CCSync.Interval.start();

  return true; // Loaded succesfully.
};

// Init mod
CCSync.init();