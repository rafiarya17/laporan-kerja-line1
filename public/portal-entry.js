(function () {
  var query = new URLSearchParams(location.search);
  if (query.get('rekap') === '1') return;
  var view = location.hash.slice(1);
  var paths = {
    '': '/dashboard', ringkasan: '/dashboard', performa: '/dashboard',
    monitor: '/dashboard#live', live: '/monitor-live.html'
  };
  if (Object.prototype.hasOwnProperty.call(paths, view)) location.replace(paths[view]);
})();
