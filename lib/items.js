'use strict';

module.exports = function( app ) {
  return function( file, itemCB, doneCB ) {
    let rl = require( 'readline' ).createInterface({
      input: require( 'fs' ).createReadStream( file )
    });
    rl.on( 'close', doneCB );
    rl.on( 'line', function( str ) {
      try {
	itemCB( null, JSON.parse( str ), rl );
      } catch( err ) {
	itemCB( err );
      }
    });
  };
};
