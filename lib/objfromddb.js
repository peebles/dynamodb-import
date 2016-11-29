module.exports = function( app ) {
  return function(ddb) {
    if(typeof ddb === 'object') {
      var res = {};
      for(var i in ddb) {
        if(ddb.hasOwnProperty(i)) {
          if(ddb[i]['s'])
            res[i] = ddb[i]['s'];
          else if(ddb[i]['ss'])
            res[i] = ddb[i]['ss'];
          else if(ddb[i]['n'])
            res[i] = parseFloat(ddb[i]['n']);
          else if(ddb[i]['ns']) {
            res[i] = [];
            for(var j = 0; j < ddb[i]['ns'].length; j ++) {
              res[i][j] = parseFloat(ddb[i]['ns'][j]);
            }
          } else if(ddb[i]['l']) {
            res[i] = [];
            ddb[i]['l'].forEach(function(item) {
              res[i].push(objFromDDB(item));
            });
            // or if 'M'
          } else if(typeof ddb[i] === 'object') {
            res[i] = objFromDDB(ddb[i]['m']);
          }
          else
            throw new Error('Non Compatible Field [not "s"|"n"|"ns"|"ss"]: ' + i);
        }
      }
      return res;
    }
    else
      return ddb;
  };
};
