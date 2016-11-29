'use strict';
module.exports = function( app ) {
  return function( argv ) {
    let bag = {};
    let arg;
    while( arg = argv.shift() ) {
      let i = arg.match( /^--(.+)/ );
      if ( i && i.length == 2 ) {
	bag[ i[1] ] = argv.shift();
      }
    }
    return bag;
  };
};
