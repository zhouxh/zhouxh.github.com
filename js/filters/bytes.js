angular.module('webui.filters.bytes', ["webui.services.utils"])
.filter('blength', ['$filter', "$utils", function(filter, utils) {
  return utils.fmtsize;
}])
.filter('bspeed', ['$filter', "$utils", function(filter, utils) {
  return utils.fmtspeed;
}])
.filter('time', function() {
  function pad(f) {
    return ("0" + f).substr(-2);
  }

  return function(time) {
    time = parseInt(time, 10);
    if (!time || !isFinite(time)) return "无限";
    var secs = time % 60;
    if (time < 60) return secs + "秒";
    var mins = Math.floor((time % 3600) / 60)
    if (time < 3600) return pad(mins) + "分" + pad(secs)+ "秒";
    var hrs = Math.floor((time % 86400) / 3600);
    if (time < 86400) return pad(hrs) + "小时" + pad(mins) + "分" + pad(secs)+ "秒";
    var days = Math.floor(time / 86400);
    return days + "天" +  pad(hrs) + "小时" + pad(mins) + "分" + pad(secs)+ "秒";
  };
});
