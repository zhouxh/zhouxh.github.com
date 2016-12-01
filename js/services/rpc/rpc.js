angular
.module('webui.services.rpc', [
  'webui.services.rpc.syscall', 'webui.services.constants', 'webui.services.alerts',
  'webui.services.utils'
])
.factory('$rpc', [
  '$syscall', '$globalTimeout', '$alerts', '$utils',
  '$rootScope', '$location',
function(syscall, time, alerts, utils, rootScope, uri) {

  var subscriptions = []
    , configurations = [{ host: '192.168.1.1', port: 6800, encrypt: false }]
    , currentConf = {}
    , timeout = null
    , forceNextUpdate = false;

  if (['http', 'https'].indexOf(uri.protocol()) != -1) {
    console.log(uri.host());
    configurations.unshift({
      host: uri.host(),
      port: 6800,
      encrypt: false
    });
    console.log(configurations);
  }

  var cookieConf = utils.getCookie('aria2conf');

  // try at the end, so that it is not overwridden in case it doesnt work
  if (cookieConf) configurations.push(cookieConf);

  // update is implemented such that
  // only one syscall at max is ongoing
  // (i.e. serially) so should be private
  // to maintain that invariant
  var update = function() {

    clearTimeout(timeout);
    timeout = null;

    subscriptions = _.filter(subscriptions, function(e) {
      return !!e && e.once !== 2;
    });
    var subs = subscriptions.slice();
    if (!subs.length) {
      timeout = setTimeout(update, time);
      return;
    }

    if (configurations.length) {
      currentConf = configurations.shift();
      syscall.init(currentConf);
    }

    var params = _.map(subs, function(s) {
      return {
        methodName: s.name,
        params: s.params && s.params.length ? s.params : undefined
      };
    });

    syscall.invoke({
      name: 'system.multicall',
      params: [params],
      success: function(data) {

        if (configurations.length) {
          // configuration worked, save it in cookie for next time and
          // delete the pipelined configurations!!
          alerts.log('成功连接！正在保存当前配置……');
          configurations = [];
        }

        utils.setCookie('aria2conf', currentConf);

        var cbs = [];
        _.each(data.result, function(d, i) {
          var handle = subs[i];
          if (handle) {
            if (d.code) {
              console.error(handle, d);
              alerts.addAlert(d.message, 'error');
            }
            // run them later as the cb itself can mutate the subscriptions
            cbs.push({cb: handle.cb, data: d});
            if (handle.once) {
              handle.once = 2;
            }
          }
        });


        _.each(cbs, function(hnd) {
          hnd.cb(hnd.data);
        });

        rootScope.$digest();

        if (forceNextUpdate) {
          forceNextUpdate = false;
          timeout = setTimeout(update, 0);
        }
        else {
          timeout = setTimeout(update, time);
        }
      },
      error: function() {
        // If some proposed configurations are still in the pipeline then retry
        if (configurations.length) {
          alerts.log("最后一个连接请求失败。正在尝试另一个配置……");
          timeout = setTimeout(update, 0);
        }
        else {
          alerts.addAlert('<strong>哇哦~！</strong> 不能连接到Aria2 RPC服务器，将在' + time / 1000 + '秒后重试；您可能需要检查连接设置，路径：设置>Web客户端连接设置', 'error');
          timeout = setTimeout(update, time);
        }
      }
    });
  };

  // initiate the update loop
  timeout = setTimeout(update, time);

  return {
    // conf can be configuration or array of configurations,
    // each one will be tried one after the other till success,
    // for all options for one conf read rpc/syscall.js
    configure: function(conf) {
      alerts.addAlert('Successfully changed aria2 connection configuration', 'success');

      if (conf instanceof Array)
        configurations = conf;
      else
        configurations = [conf];
    },

    // get current configuration being used
    getConfiguration: function() { return currentConf },

    // syscall is done only once, delay is optional
    // and pass true to only dispatch it in the global timeout
    // which can be used to batch up once calls
    once: function(name, params, cb, delay) {
      cb = cb || angular.noop;
      params = params || [];

      subscriptions.unshift({
        once: true,
        name: 'aria2.' + name,
        params: params,
        cb: cb
      });

      if (!delay) {
        this.forceUpdate();
      }
    },

    // callback is called each time with updated syscall data
    // after the global timeout, delay is optional and pass it
    // true to dispatch the first syscall also on global timeout
    // which can be used to batch the subscribe calls
    subscribe: function(name, params, cb, delay) {
      cb = cb || angular.noop;
      params = params || [];

      var handle = {
        once: false,
        name: 'aria2.' + name,
        params: params,
        cb: cb
      };
      subscriptions.push(handle);

      if (!delay) this.forceUpdate();
      return handle;
    },

    // remove the subscribed callback by passing
    // the returned handle bysubscribe
    unsubscribe: function(handle) {
      var ind = subscriptions.indexOf(handle);
      subscriptions[ind] = null;
    },

    // force the global syscall update
    forceUpdate: function() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = setTimeout(update, 0);
      }
      else {
        // a batch call is already in progress,
        // wait till it returns and force the next one
        forceNextUpdate = true;
      }
    }
  };
}]);
